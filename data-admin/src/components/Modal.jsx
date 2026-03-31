import { useEffect } from "react";

/**
 * @param {{ title: string, onClose: () => void, children: import("react").ReactNode, footer?: import("react").ReactNode, wide?: boolean }} props
 */
export default function Modal({ title, onClose, children, footer, wide }) {
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = prev;
            document.removeEventListener("keydown", onKey);
        };
    }, [onClose]);

    return (
        <div className="modal-backdrop" onClick={onClose} role="presentation">
            <div
                className={`modal-dialog${wide ? " modal-dialog-wide" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-head">
                    <h3 id="modal-title" style={{ margin: 0, fontSize: "1.1rem" }}>
                        {title}
                    </h3>
                    <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
                        ×
                    </button>
                </div>
                <div className="modal-body">{children}</div>
                {footer ? <div className="modal-foot">{footer}</div> : null}
            </div>
        </div>
    );
}
