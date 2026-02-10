package asynqmon

import (
	"fmt"
	"testing"

	"github.com/hibiken/asynq"
)

func TestListTasksDesc(t *testing.T) {
	makeTasks := func(total int) []*asynq.TaskInfo {
		tasks := make([]*asynq.TaskInfo, total)
		for i := 0; i < total; i++ {
			tasks[i] = &asynq.TaskInfo{ID: fmt.Sprintf("task-%d", i)}
		}
		return tasks
	}

	listPage := func(all []*asynq.TaskInfo, pageSize int) func(pageNum int) ([]*asynq.TaskInfo, error) {
		return func(pageNum int) ([]*asynq.TaskInfo, error) {
			start := (pageNum - 1) * pageSize
			if start >= len(all) {
				return []*asynq.TaskInfo{}, nil
			}
			end := start + pageSize
			if end > len(all) {
				end = len(all)
			}
			return all[start:end], nil
		}
	}

	tests := []struct {
		name     string
		total    int
		pageSize int
		pageNum  int
		want     []string
	}{
		{
			name:     "aligned first page",
			total:    100,
			pageSize: 20,
			pageNum:  1,
			want: []string{
				"task-99", "task-98", "task-97", "task-96", "task-95",
				"task-94", "task-93", "task-92", "task-91", "task-90",
				"task-89", "task-88", "task-87", "task-86", "task-85",
				"task-84", "task-83", "task-82", "task-81", "task-80",
			},
		},
		{
			name:     "aligned second page",
			total:    100,
			pageSize: 20,
			pageNum:  2,
			want: []string{
				"task-79", "task-78", "task-77", "task-76", "task-75",
				"task-74", "task-73", "task-72", "task-71", "task-70",
				"task-69", "task-68", "task-67", "task-66", "task-65",
				"task-64", "task-63", "task-62", "task-61", "task-60",
			},
		},
		{
			name:     "unaligned first page spans two source pages",
			total:    45,
			pageSize: 20,
			pageNum:  1,
			want: []string{
				"task-44", "task-43", "task-42", "task-41", "task-40",
				"task-39", "task-38", "task-37", "task-36", "task-35",
				"task-34", "task-33", "task-32", "task-31", "task-30",
				"task-29", "task-28", "task-27", "task-26", "task-25",
			},
		},
		{
			name:     "last page partial",
			total:    45,
			pageSize: 20,
			pageNum:  3,
			want:     []string{"task-4", "task-3", "task-2", "task-1", "task-0"},
		},
		{
			name:     "out of range",
			total:    45,
			pageSize: 20,
			pageNum:  4,
			want:     []string{},
		},
		{
			name:     "zero page size",
			total:    45,
			pageSize: 0,
			pageNum:  1,
			want:     []string{},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			all := makeTasks(tc.total)
			got, err := listTasksDesc(tc.total, tc.pageSize, tc.pageNum, listPage(all, tc.pageSize))
			if err != nil {
				t.Fatalf("listTasksDesc error: %v", err)
			}
			if len(got) != len(tc.want) {
				t.Fatalf("len(got)=%d, want=%d", len(got), len(tc.want))
			}
			for i := range got {
				if got[i].ID != tc.want[i] {
					t.Fatalf("got[%d]=%q, want=%q", i, got[i].ID, tc.want[i])
				}
			}
		})
	}
}
