import React from 'react';
import SolarPearLogo from './SolarPearLogo';
import {
    Layers,
    Server,
    LayoutDashboard,
    AlertTriangle,
    Info,
    Download,
    Upload,
    RotateCcw
} from './Icons';

/**
 * @typedef {object} GuideProps
 * @property {boolean} [omitHero] When true, skips the duplicate logo/tagline block (used when the parent already shows branding).
 */

/**
 * Long-form onboarding and reference content for Solar Pear.
 *
 * @param {GuideProps} props
 * @returns {import('react').ReactElement}
 */
const Guide = ({ omitHero = false }) => {
    return (
        <div className="max-w-4xl mx-auto space-y-10 py-10 px-4">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 border border-amber-200/80 py-2.5 px-4 text-amber-800 text-sm font-medium tracking-wide">
                <span className="inline-flex items-center rounded-md bg-amber-200/60 px-2 py-0.5 font-semibold uppercase tracking-wider text-amber-900 text-xs">
                    Beta
                </span>
                <span>Solar Pear is in beta. Data and features may change. We welcome feedback.</span>
            </div>

            {!omitHero && (
                <header className="text-center space-y-5 pt-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Quick guide</p>
                    <SolarPearLogo className="w-56 h-auto text-slate-900 mx-auto" />
                    <p className="text-lg text-slate-600 max-w-xl mx-auto leading-relaxed">
                        Free roofspace, panel, and controller matching.
                    </p>
                </header>
            )}

            <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 bg-slate-200/80 text-slate-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Info size={20} />
                </div>
                <div>
                    <p className="text-slate-600 leading-relaxed text-sm">
                        Solar Pear is free to use and includes a broad database of panels and PV controllers. Use it to find combinations that fit your roofspace and stay electrically compatible.
                    </p>
                </div>
            </div>

            <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/80">
                    <h2 className="text-lg font-bold text-slate-800">Area and Array</h2>
                    <p className="text-slate-600 text-sm mt-1">Two core ideas used across the planner.</p>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200/80 space-y-3">
                        <h3 className="text-lg font-bold text-slate-800">Area</h3>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            A named part of your site, like <span className="font-semibold text-slate-900">Main Roof</span> or <span className="font-semibold text-slate-900">Garage</span>.
                            Area settings define system context such as voltage and system type.
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200/80 space-y-3">
                        <h3 className="text-lg font-bold text-slate-800">Array</h3>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            A physical panel group inside an Area. This is where panel fit, stringing, and controller matching are checked.
                        </p>
                    </div>
                </div>
            </section>

            <section aria-labelledby="guide-start-points">
                <h2 id="guide-start-points" className="sr-only">Start points</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 space-y-3 hover:border-slate-300/80 transition-colors">
                        <h3 className="text-lg font-bold text-slate-800">Start from roofspace</h3>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            Set up your Areas and Arrays, then use layout constraints to find panels that physically fit first.
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 space-y-3 hover:border-slate-300/80 transition-colors">
                        <h3 className="text-lg font-bold text-slate-800">Start from a panel</h3>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            Choose a preferred panel model, then narrow down compatible controllers for each Array.
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 space-y-3 hover:border-slate-300/80 transition-colors">
                        <h3 className="text-lg font-bold text-slate-800">Start from a controller</h3>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            Pick a preferred PV controller first, then filter to panels and stringing options that work with it.
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 space-y-3 hover:border-slate-300/80 transition-colors">
                        <h3 className="text-lg font-bold text-slate-800">Match the rest of the system</h3>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            Whatever you start with, the workflow helps you match the remaining panel and controller choices around it.
                        </p>
                    </div>
                </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/80">
                    <h2 className="text-lg font-bold text-slate-800">Typical workflow</h2>
                    <p className="text-slate-600 text-sm mt-1">A quick path through the app tabs.</p>
                </div>
                <div className="p-5 space-y-6">
                    <section>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Layers size={18} />
                            </div>
                            <h3 className="text-base font-bold text-slate-800">Setup Areas and Arrays</h3>
                        </div>
                        <ul className="space-y-1.5 text-slate-600 text-sm list-disc list-inside ml-1">
                            <li>Add each installation area from the sidebar.</li>
                            <li>Add one or more Arrays inside each Area.</li>
                            <li>Set Array constraints such as mounting, format, and panel limits.</li>
                        </ul>
                    </section>
                    <section>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-9 h-9 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <LayoutDashboard size={18} />
                            </div>
                            <h3 className="text-base font-bold text-slate-800">Pick panels and layout</h3>
                        </div>
                        <ul className="space-y-1.5 text-slate-600 text-sm list-disc list-inside ml-1">
                            <li>Use the panel database to choose models you want to compare.</li>
                            <li>Use the layout and planner tools to check roofspace fit.</li>
                            <li>Only keep panel options that work for that Array.</li>
                        </ul>
                    </section>
                    <section>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-9 h-9 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Server size={18} />
                            </div>
                            <h3 className="text-base font-bold text-slate-800">Match PV controllers</h3>
                        </div>
                        <ul className="space-y-1.5 text-slate-600 text-sm list-disc list-inside ml-1">
                            <li>Use controller filters to find models that match your system setup.</li>
                            <li>Check Voc, Vmp, and Isc compatibility before finalizing.</li>
                            <li>Review the System Summary and BoM once Arrays are configured.</li>
                        </ul>
                    </section>
                </div>
            </section>

            <section className="bg-slate-900 rounded-xl p-6 text-slate-300 border border-slate-700/80 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="text-amber-400 flex-shrink-0" size={22} />
                    <h2 className="text-lg font-bold text-white">Limitations and assumptions</h2>
                </div>
                <ul className="space-y-3 text-sm list-disc list-inside">
                    <li><span className="text-white font-medium">Costs are estimates:</span> pre-loaded prices are placeholders. Use your own values for reliable budgeting.</li>
                    <li><span className="text-white font-medium">BoM scope is limited:</span> summary includes panels and PV controllers only, not full installation hardware.</li>
                    <li><span className="text-white font-medium">Compatibility, not schematics:</span> checks validate electrical ranges but do not produce wiring diagrams.</li>
                    <li><span className="text-white font-medium">Local browser storage:</span> projects are saved locally unless you export them.</li>
                </ul>
            </section>
            <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/80 text-slate-800">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Download size={20} className="text-blue-600 flex-shrink-0" />
                        Data Management: Save, Transfer & Reset
                    </h2>
                </div>
                <div className="p-5 grid md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
                            <Download size={16} className="flex-shrink-0" />
                            <span>Save</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            Export your full project to a <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs">.json</span> backup file from the sidebar.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
                            <Upload size={16} className="flex-shrink-0" />
                            <span>Restore</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            Import a backup to continue work on another device or after clearing browser data.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-red-600 font-semibold text-sm">
                            <RotateCcw size={16} className="flex-shrink-0" />
                            <span>Reset</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            Reset clears local project data and returns the app to defaults. Keep a backup first.
                        </p>
                    </div>
                </div>
            </section>
        </div>

    );
};

export default Guide;
