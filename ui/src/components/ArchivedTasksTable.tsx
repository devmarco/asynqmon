import Checkbox from "@material-ui/core/Checkbox";
import IconButton from "@material-ui/core/IconButton";
import TableCell from "@material-ui/core/TableCell";
import TableRow from "@material-ui/core/TableRow";
import Tooltip from "@material-ui/core/Tooltip";
import DeleteIcon from "@material-ui/icons/Delete";
import FileCopyOutlinedIcon from "@material-ui/icons/FileCopyOutlined";
import MoreHorizIcon from "@material-ui/icons/MoreHoriz";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import React, { useCallback } from "react";
import { connect, ConnectedProps } from "react-redux";
import { useHistory } from "react-router-dom";
import { taskRowsPerPageChange } from "../actions/settingsActions";
import {
  batchDeleteArchivedTasksAsync,
  batchRunArchivedTasksAsync,
  deleteAllArchivedTasksAsync,
  deleteArchivedTaskAsync,
  listArchivedTasksAsync,
  runAllArchivedTasksAsync,
  runArchivedTaskAsync,
} from "../actions/tasksActions";
import { listArchivedTasks, TaskInfo } from "../api";
import { taskDetailsPath } from "../paths";
import { AppState } from "../store";
import { TableColumn } from "../types/table";
import { timeAgo, uuidPrefix } from "../utils";
import SyntaxHighlighter from "./SyntaxHighlighter";
import TasksTable, { RowProps, useRowStyles } from "./TasksTable";

function mapStateToProps(state: AppState) {
  return {
    loading: state.tasks.archivedTasks.loading,
    error: state.tasks.archivedTasks.error,
    tasks: state.tasks.archivedTasks.data,
    batchActionPending: state.tasks.archivedTasks.batchActionPending,
    allActionPending: state.tasks.archivedTasks.allActionPending,
    pollInterval: state.settings.pollInterval,
    pageSize: state.settings.taskRowsPerPage,
  };
}

const mapDispatchToProps = {
  listTasks: listArchivedTasksAsync,
  runTask: runArchivedTaskAsync,
  runAllTasks: runAllArchivedTasksAsync,
  deleteTask: deleteArchivedTaskAsync,
  deleteAllTasks: deleteAllArchivedTasksAsync,
  batchRunTasks: batchRunArchivedTasksAsync,
  batchDeleteTasks: batchDeleteArchivedTasksAsync,
  taskRowsPerPageChange,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type ReduxProps = ConnectedProps<typeof connector>;

interface Props {
  queue: string; // name of the queue.
  totalTaskCount: number; // totoal number of archived tasks.
  searchQuery?: string;
}

const columns: TableColumn[] = [
  { key: "id", label: "ID", align: "left" },
  { key: "type", label: "Type", align: "left" },
  { key: "payload", label: "Payload", align: "left" },
  { key: "last_failed", label: "Last Failed", align: "left" },
  { key: "last_error", label: "Last Error", align: "left" },
  { key: "actions", label: "Actions", align: "center" },
];

function Row(props: RowProps) {
  const { task } = props;
  const classes = useRowStyles();
  const history = useHistory();
  return (
    <TableRow
      key={task.id}
      className={classes.root}
      selected={props.isSelected}
      onClick={() => history.push(taskDetailsPath(task.queue, task.id))}
    >
      {!window.READ_ONLY && (
        <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
          <IconButton>
            <Checkbox
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                props.onSelectChange(event.target.checked)
              }
              checked={props.isSelected}
            />
          </IconButton>
        </TableCell>
      )}
      <TableCell component="th" scope="row" className={classes.idCell}>
        {uuidPrefix(task.id)}
      </TableCell>
      <TableCell>{task.type}</TableCell>
      <TableCell>
        <SyntaxHighlighter
          language="json"
          customStyle={{ margin: 0, maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {task.payload}
        </SyntaxHighlighter>
      </TableCell>
      <TableCell>{timeAgo(task.last_failed_at)}</TableCell>
      <TableCell>{task.error_message}</TableCell>
      {!window.READ_ONLY && (
        <TableCell
          align="center"
          className={classes.actionCell}
          onMouseEnter={props.onActionCellEnter}
          onMouseLeave={props.onActionCellLeave}
          onClick={(e) => e.stopPropagation()}
        >
          {props.showActions ? (
            <React.Fragment>
              <Tooltip title="Copy full ID to clipboard">
                <IconButton
                  className={classes.actionButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(task.id);
                  }}
                  disabled={task.requestPending || props.allActionPending}
                  size="small"
                >
                  <FileCopyOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton
                  className={classes.actionButton}
                  onClick={props.onDeleteClick}
                  disabled={task.requestPending || props.allActionPending}
                  size="small"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Run">
                <IconButton
                  className={classes.actionButton}
                  onClick={props.onRunClick}
                  disabled={task.requestPending || props.allActionPending}
                  size="small"
                >
                  <PlayArrowIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </React.Fragment>
          ) : (
            <IconButton size="small" onClick={props.onActionCellEnter}>
              <MoreHorizIcon fontSize="small" />
            </IconButton>
          )}
        </TableCell>
      )}
    </TableRow>
  );
}

function escapeCsvField(field: string): string {
  if (field.includes('"') || field.includes(",") || field.includes("\n")) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

function tasksToCsv(tasks: TaskInfo[]): string {
  const headers = [
    "ID",
    "Type",
    "Queue",
    "Payload",
    "Max Retry",
    "Retried",
    "Last Failed",
    "Error Message",
  ];
  const rows = tasks.map((t) =>
    [
      t.id,
      t.type,
      t.queue,
      t.payload,
      String(t.max_retry),
      String(t.retried),
      t.last_failed_at,
      t.error_message,
    ]
      .map(escapeCsvField)
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ArchivedTasksTable(props: Props & ReduxProps) {
  const { queue } = props;

  const handleExport = useCallback(async () => {
    const pageSize = 100;
    const maxTasks = 10000;
    // Fetch first page to get tasks and total count
    const firstPage = await listArchivedTasks(queue, { page: 1, size: pageSize });
    const totalCount = firstPage.stats.archived;

    if (totalCount > maxTasks) {
      alert(
        `There are ${totalCount.toLocaleString()} archived tasks. Export is limited to the first ${maxTasks.toLocaleString()} tasks.`
      );
    }

    const cappedCount = Math.min(totalCount, maxTasks);
    const allTasks: TaskInfo[] = [...firstPage.tasks];

    if (cappedCount > pageSize) {
      const totalPages = Math.ceil(cappedCount / pageSize);
      // Fetch in batches of 10 to limit concurrency
      for (let batch = 2; batch <= totalPages; batch += 10) {
        const end = Math.min(batch + 10, totalPages + 1);
        const promises = [];
        for (let p = batch; p < end; p++) {
          promises.push(listArchivedTasks(queue, { page: p, size: pageSize }));
        }
        const results = await Promise.all(promises);
        for (const result of results) {
          allTasks.push(...result.tasks);
        }
      }
    }

    const csv = tasksToCsv(allTasks);
    downloadCsv(csv, `archived_tasks_${queue}.csv`);
  }, [queue]);

  return (
    <TasksTable
      taskState="archived"
      columns={columns}
      renderRow={(rowProps: RowProps) => <Row {...rowProps} />}
      onExport={handleExport}
      {...props}
    />
  );
}

export default connector(ArchivedTasksTable);
