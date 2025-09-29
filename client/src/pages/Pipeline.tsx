import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { usePipeline } from '../hooks/usePipeline';
import { useCandidates } from '../hooks/useCandidates';
import { useNotifications } from '../hooks/useNotifications';
import { PipelineColumnSkeleton } from '../components/LoadingStates';

const PipelinePage = () => {
  const { stages, loading: stagesLoading, moveCandidateToPipeline, getCandidatesByStage } = usePipeline();
  const { candidates, loading: candidatesLoading } = useCandidates();
  const { success, error } = useNotifications();

  const handleDragEnd = async (result: DropResult) => {
    (window as any).__dragEndCalled = true;
    console.log('🎯 handleDragEnd called with result:', result);

    if (!result.destination) {
      console.log('❌ No destination, drag cancelled');
      return;
    }

    const candidateId = result.draggableId;
    const newStageId = result.destination.droppableId;
    console.log(`📋 Moving candidate ${candidateId} to stage ${newStageId}`);

    try {
      console.log('🚀 Calling moveCandidateToPipeline...');
      await moveCandidateToPipeline(candidateId, newStageId);
      console.log('✅ Move successful, showing success message');
      success('Candidate moved successfully!');
    } catch (err) {
      console.error('❌ Move failed:', err);
      error('Failed to move candidate');
    }
  };

  if (stagesLoading || candidatesLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Pipeline</h1>
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <PipelineColumnSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Pipeline</h1>
      
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="kanban-board grid grid-cols-5 gap-4" data-testid="kanban-board">
          {stages.map((stage) => {
            const stageCandidates = getCandidatesByStage(stage.id);
            
            return (
              <div key={stage.id} className="pipeline-stage bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3" style={{ color: stage.color }}>
                  {stage.name} ({stageCandidates.length})
                </h3>
                
                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[400px] ${
                        snapshot.isDraggingOver ? 'bg-blue-50' : ''
                      }`}
                    >
                      {stageCandidates.map((candidate, index) => (
                        <Draggable
                          key={candidate.id}
                          draggableId={candidate.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`kanban-card bg-white p-3 mb-2 rounded shadow-sm ${
                                snapshot.isDragging ? 'shadow-lg' : ''
                              }`}
                              data-candidate-id={candidate.id}
                            >
                              <p className="font-medium">{candidate.name}</p>
                              <p className="text-sm text-gray-600">{candidate.email}</p>
                              {candidate.score && (
                                <p className="text-sm text-blue-600 mt-1">
                                  Score: {candidate.score}%
                                </p>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
};

export default PipelinePage;
