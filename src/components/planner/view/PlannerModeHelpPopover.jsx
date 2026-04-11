export default function PlannerModeHelpPopover({ show, text }) {
    if (!show) return null;

    return (
        <div className="absolute z-30 left-0 top-full mt-1 w-[18rem] max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white shadow-lg p-3 text-[11px] text-slate-700">
            <div className="whitespace-pre-line leading-4">{text}</div>
        </div>
    );
}
