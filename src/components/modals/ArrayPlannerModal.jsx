import { useRef, useState } from 'react';
import Modal from '../Modal';
import ArrayPlanner from '../planner/ArrayPlanner';

export default function ArrayPlannerModal({
    open,
    arrayId,
    draftArrayData,
    arraysData,
    panelsData,
    onClose,
    onSavePlanner,
    onApplyCandidateToDraft,
}) {
    const plannerRef = useRef(null);
    const [header, setHeader] = useState(null);

    return (
        <Modal
            open={open}
            onClose={onClose}
            header={header}
            headerAlign='start'
            maxWidth='max-w-7xl'
            bodyScrollable={true}
            footer={
                <>
                    <button
                        type='button'
                        onClick={onClose}
                        className='px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 font-medium transition-colors'
                    >
                        Close
                    </button>
                    <button
                        type='button'
                        onClick={() => {
                            const planner = plannerRef.current?.getPlanner?.();
                            onSavePlanner?.(arrayId, planner);
                        }}
                        className='px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 font-medium transition-colors shadow-sm'
                    >
                        Save Planner
                    </button>
                </>
            }
        >
            <ArrayPlanner
                ref={plannerRef}
                active={open}
                arrayId={arrayId}
                draftArrayData={draftArrayData}
                arraysData={arraysData}
                panelsData={panelsData}
                onApplyCandidateToDraft={onApplyCandidateToDraft}
                onHeaderChange={setHeader}
            />
        </Modal>
    );
}
