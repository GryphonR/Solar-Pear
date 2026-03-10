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

const Guide = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-10 py-10 px-4">
            {/* BETA notice */}
            <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 border border-amber-200/80 py-2.5 px-4 text-amber-800 text-sm font-medium tracking-wide">
                <span className="inline-flex items-center rounded-md bg-amber-200/60 px-2 py-0.5 font-semibold uppercase tracking-wider text-amber-900 text-xs">
                    Beta
                </span>
                <span>Solar Pear is in beta. Data and features may change. We welcome feedback.</span>
            </div>

            {/* Hero */}
            <header className="text-center space-y-5 pt-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Getting started</p>
                <SolarPearLogo className="w-56 h-auto text-slate-900 mx-auto" />
                <p className="text-lg text-slate-600 max-w-xl mx-auto leading-relaxed">
                    Intelligent Pairing for roofs, panels, and controllers.
                </p>
                <p className="text-[10px] text-slate-300 max-w-xl mx-auto text-center mt-1">
                    Pairing... Pearing... no?? ... I'll get my coat
                </p>
            </header>

            <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 bg-slate-200/80 text-slate-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Info size={20} />
                </div>
                <div>
                    <p className="text-slate-600 leading-relaxed text-sm">
                        Before using this tool, you must know <span className="font-semibold text-slate-800">how many panels</span> can physically fit in each of your intended arrays. Solar Pear does not perform the initial spatial roof layout.
                    </p>
                </div>
            </div>

            <section aria-labelledby="guide-steps">
                <h2 id="guide-steps" className="sr-only">Steps</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 space-y-3 hover:border-slate-300/80 transition-colors">
                        <h3 className="text-lg font-bold text-slate-800">1. Setup Your Arrays</h3>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            Start in the <span className="font-semibold text-slate-900">Array Config</span> tab. Define your panel installation areas (e.g., "Main Roof", "Garage") and the number of panels intended for each array.
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 space-y-3 hover:border-slate-300/80 transition-colors">
                        <h3 className="text-lg font-bold text-slate-800">2. Set Parameters</h3>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            Select the type of setup you want—on or off grid, or charger only—and ensure your preferred solar panels and inverters are active in the <span className="font-semibold text-slate-900">Panels</span> and <span className="font-semibold text-slate-900">PV Controllers</span> databases.
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 space-y-3 hover:border-slate-300/80 transition-colors">
                        <h3 className="text-lg font-bold text-slate-800">3. Pick Components</h3>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            Navigate to an individual <span className="font-semibold text-slate-900">Array Tab</span>. This is where the magic happens.
                            Filter the database of panels and controllers to find the best pairing for your array, keeping everything electrically compatible.
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 space-y-3 hover:border-slate-300/80 transition-colors">
                        <h3 className="text-lg font-bold text-slate-800">4. Summary & BOM</h3>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            View an overview of your specified system and a bill of materials (panels and controllers only).
                        </p>
                    </div>
                </div>
            </section>

            {/* Feature overview */}
            <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/80">
                    <h2 className="text-lg font-bold text-slate-800">Why use Solar Pear?</h2>
                    <p className="text-slate-600 text-sm mt-1">What makes it useful compared to spreadsheets, manufacturer tools, or generic calculators.</p>
                </div>
                <div className="p-5 space-y-6">
                    <section>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Layers size={18} />
                            </div>
                            <h3 className="text-base font-bold text-slate-800">Arrays</h3>
                        </div>
                        <ul className="space-y-1.5 text-slate-600 text-sm list-disc list-inside ml-1">
                            <li><strong>One place for your whole site</strong> — model multiple roof areas and arrays instead of juggling separate tools or sheets.</li>
                            <li><strong>Electrical Checks</strong> — cold Voc and hot Vmp are calculated for your string layout so you don’t guess or oversize blindly.</li>
                            <li><strong>Physical fit</strong> — filter by max panel size and weight so you only see options that actually fit your roof and mounting.</li>
                            <li><strong>Compare fairly</strong> — see peak power and cost per kWp per array so you can choose the best panel for each spot.</li>
                        </ul>
                    </section>
                    <section>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-9 h-9 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <LayoutDashboard size={18} />
                            </div>
                            <h3 className="text-base font-bold text-slate-800">Panels</h3>
                        </div>
                        <ul className="space-y-1.5 text-slate-600 text-sm list-disc list-inside ml-1">
                            <li><strong>Roof-first, not panel-first</strong> — start from “I have N panels here” and find what works, instead of designing around one brand’s tool.</li>
                            <li><strong>Mix and match</strong> — one database for many brands; enable or hide manufacturers to focus on what you can actually source.</li>
                            <li><strong>In-roof (GSE) aware</strong> — only see panels that suit in-roof if that’s your mounting, so you avoid incompatible choices.</li>
                        </ul>
                    </section>
                    <section>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-9 h-9 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Server size={18} />
                            </div>
                            <h3 className="text-base font-bold text-slate-800">PV Controllers</h3>
                        </div>
                        <ul className="space-y-1.5 text-slate-600 text-sm list-disc list-inside ml-1">
                            <li><strong>Panel and controller in one flow</strong> — pick panels then see which controllers match (or the other way round), without switching apps.</li>
                            <li><strong>Proper compatibility checks</strong> — Voc, Vmp, and Isc are validated so you don’t pair a string that’s outside the controller’s range.</li>
                            <li><strong>System type and voltage</strong> — filter by DC bus (12–96 V), grid vs off-grid, and EPS/backup so you only see relevant kit.</li>
                            <li><strong>Multiple controllers per array</strong> — model splitting an array across units and keep everything electrically consistent.</li>
                        </ul>
                    </section>
                </div>
            </section>

            <section className="bg-slate-900 rounded-xl p-6 text-slate-300 border border-slate-700/80 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="text-amber-400 flex-shrink-0" size={22} />
                    <h2 className="text-lg font-bold text-white">Limitations & Disclaimers</h2>
                </div>
                <ul className="space-y-3 text-sm list-disc list-inside">
                    <li><span className="text-white font-medium">Prices:</span> All pre-loaded costs are estimates. Enter your own researched prices for a more accurate BoM.</li>
                    <li><span className="text-white font-medium">Panels and controller only:</span> The BoM only includes panels and controllers - no harnessing, connectors, mounting etc! This is not your final install price.</li>
                    <li><span className="text-white font-medium">AI-Derived Notes:</span> Technical notes on each Panel/Controller are synthesized using AI models. Take them with a pinch of salt! They will be improved over time.</li>
                    <li><span className="text-white font-medium">Not a Wiring Diagram:</span> This tool verifies electrical compatibility (Voc, Vmp, Isc) but does not generate schematic diagrams.</li>
                    <li><span className="text-white font-medium">Local Storage:</span> All your changes and site configurations are stored locally in your browser. Clearing your cache or using a different browser will reset your progress.</li>
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
                            Click the blue download button in the sidebar to export your entire project as a <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs">.json</span> file. This is the only way to save your work permanently outside of this browser.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
                            <Upload size={16} className="flex-shrink-0" />
                            <span>Restore</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            To view your project on another computer or after clearing your cache, use the green upload button to import your saved backup file.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-red-600 font-semibold text-sm">
                            <RotateCcw size={16} className="flex-shrink-0" />
                            <span>Reset</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            Use the red reset button to wipe all local data and return the application to its default state. Warning: this cannot be undone without a backup!
                        </p>
                    </div>
                </div>
            </section>
        </div>

    );
};

export default Guide;
