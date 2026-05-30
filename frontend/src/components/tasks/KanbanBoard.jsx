import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Circle, ArrowUpCircle, CheckCircle2, Plus } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import TaskCard from './TaskCard';

const columns = [
  { id: 'TODO', title: 'To Do', icon: Circle, color: 'bg-slate-300 dark:bg-slate-700' },
  { id: 'IN_PROGRESS', title: 'In Progress', icon: ArrowUpCircle, color: 'bg-slate-500 dark:bg-slate-500' },
  { id: 'DONE', title: 'Done', icon: CheckCircle2, color: 'bg-emerald-400/50 dark:bg-emerald-900/40' },
];

export default function KanbanBoard({ tasks, user, onDragEnd, onEdit, onDelete, onStatusChange, onOpenDetail, onCreateNew, onMouseEnterCard, onMouseLeaveCard, focusedTaskId }) {

  const getTasksByStatus = (status) => tasks.filter(t => t.status === status);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map(column => {
          const Icon = column.icon;
          const columnTasks = getTasksByStatus(column.id);

          return (
            <div key={column.id} className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${column.color}`} />
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{column.title}</h3>
                  <span className="text-[10px] text-slate-400/60 font-medium">/ {columnTasks.length}</span>
                </div>
                {column.id === 'TODO' && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onCreateNew()}>
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 min-h-[300px] p-3 rounded-2xl transition-colors ${snapshot.isDraggingOver
                      ? 'bg-slate-100/80 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700'
                      : 'bg-slate-100/30 dark:bg-slate-900/10 border border-transparent'
                      }`}
                  >
                    <div className="space-y-3">
                      <AnimatePresence>
                        {columnTasks.map((task, index) => {
                          const currentUserId = String(user?.id || user?.user?.id || '').toLowerCase();
                          const taskCreatorId = String(task.creator_id || task.user_id || '').toLowerCase();
                          const taskAssigneeId = String(task.assignee_id || task.assigned_to || '').toLowerCase();

                          const isCreator = currentUserId === taskCreatorId;
                          const isAssignee = currentUserId === taskAssigneeId;

                          const hasValidAssignee = taskAssigneeId !== '' && taskAssigneeId !== 'null';
                          const canDrag = hasValidAssignee ? isAssignee : isCreator;

                          return (
                            <Draggable
                              key={task.id}
                              draggableId={task.id}
                              index={index}
                              isDragDisabled={!canDrag}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                >
                                  <TaskCard
                                    task={task}
                                    user={user}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    onStatusChange={onStatusChange}
                                    onOpenDetail={onOpenDetail}
                                    isDragging={snapshot.isDragging}
                                    onMouseEnter={() => onMouseEnterCard(task)}
                                    onMouseLeave={onMouseLeaveCard}
                                    isFocused={focusedTaskId === task.id}
                                  />
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                      </AnimatePresence>
                      {columnTasks.length === 0 && !snapshot.isDraggingOver && (
                        <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-8">
                          No tasks here
                        </p>
                      )}
                    </div>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}