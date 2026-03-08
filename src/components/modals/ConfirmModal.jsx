import React from 'react';
import Modal from '../Modal';

export default function ConfirmModal({ open, title, message, onConfirm, onCancel }) {
    const handleConfirm = () => {
        onConfirm?.();
        onCancel?.();
    };

    return (
        <Modal
            open={open}
            onClose={onCancel}
            title={title}
            maxWidth="max-w-sm"
            bodyScrollable={false}
            zIndex={100}
            footer={
                <>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium transition-colors shadow-sm"
                    >
                        Confirm
                    </button>
                </>
            }
        >
            <p className="text-slate-600 text-sm leading-relaxed">{message}</p>
        </Modal>
    );
}
