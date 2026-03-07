import React from 'react';
import SolarPearLogo from './SolarPearLogo';
import {
    Layers,
    Server,
    CheckCircle,
    LayoutDashboard,
    AlertTriangle,
    Info,
    Download,
    Upload,
    RotateCcw
} from './Icons';

const Guide = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-12 py-8">
            <div className="flex flex-col items-center text-center space-y-6">
                <SolarPearLogo className="w-64 h-auto text-slate-900" />
                <p className="text-xl text-slate-600 max-w-2xl leading-relaxed">
                    {/* Welcome to Solar Pear - a tool designed for selecting panels to make the most of your roofspace, and to pair them with the right controller - or vice versa! */}
                    Pair the right panels with your roofspace.<br></br> Pair the right controller with your panels.
                </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 flex items-start gap-4 shadow-sm">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Info size={20} />
                </div>
                <div>
                    <h4 className="text-lg font-bold text-slate-900 mb-1">Prerequisite:</h4>
                    <p className="text-slate-600 leading-relaxed">
                        Before using this tool, you must know <span className="font-semibold">how many panels</span> can physically fit in each of your intended arrays. Solar Pear does not perform the initial spatial roof layout.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                        <Layers size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">1. Setup Your Arrays</h3>
                    <p className="text-slate-600 leading-relaxed">
                        Start in the <span className="font-semibold text-slate-900">Array Config</span> tab. Define your panel installation areas (e.g., "Main Roof", "Garage") and the number of panels intended for each array.
                    </p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4">
                        <Server size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">2. Constrain Hardware</h3>
                    <p className="text-slate-600 leading-relaxed">
                        Select the type of setup you want - on or off grid, or charger only - and ensure your preferred solar panels and inverters are active in the <span className="font-semibold text-slate-900">Panels</span> and <span className="font-semibold text-slate-900">PV Controllers</span> databases.
                    </p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                    <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-4">
                        <CheckCircle size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">3. Pick Components</h3>
                    <p className="text-slate-600 leading-relaxed">
                        Navigate to an individual <span className="font-semibold text-slate-900">Array Tab</span>. Pick optimum panels for your roof and mounting constraints, and ensure that everything is electrically compatible.
                    </p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                        <LayoutDashboard size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">4. Summary & BOM</h3>
                    <p className="text-slate-600 leading-relaxed">
                        The <span className="font-semibold text-slate-900">An Overview of your specified system, and a bill of materials (Panels and Controllers only).</span>
                    </p>
                </div>
            </div>



            <div className="bg-slate-900 rounded-2xl p-8 text-slate-300 border border-slate-800 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                    <AlertTriangle className="text-amber-400" size={24} />
                    <h3 className="text-xl font-bold text-white">Limitations & Disclaimers</h3>
                </div>
                <ul className="space-y-4 list-disc list-inside">
                    <li><span className="text-white font-medium">Prices:</span> All pre-loaded costs are estimates. Enter your own researched prices for a more accurate BoM.</li>
                    <li><span className="text-white font-medium">Panels and controller only:</span> The BoM only includes panels and controllers - no harnessing, connectors, mounting etc! This is not your final install price.</li>
                    <li><span className="text-white font-medium">AI-Derived Notes:</span> Technical notes on each Panel/Controller are synthesized using AI models. Take them with a pinch of salt! They will be improved over time.</li>
                    <li><span className="text-white font-medium">Not a Wiring Diagram:</span> This tool verifies electrical compatibility (Voc, Vmp, Isc) but does not generate schematic diagrams.</li>
                    <li><span className="text-white font-medium">Local Storage:</span> All your changes and site configurations are stored locally in your browser. Clearing your cache or using a different browser will reset your progress.</li>
                </ul>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50 text-slate-800">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Download size={22} className="text-blue-600" />
                        Data Management: Save, Transfer & Reset
                    </h3>
                </div>
                <div className="p-8 grid md:grid-cols-3 gap-8">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-blue-600 font-bold">
                            <Download size={18} />
                            <span>Backup (Save)</span>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            Click the blue download button in the sidebar to export your entire project as a <span className="font-mono bg-slate-100 px-1 rounded">.json</span> file. This is the only way to save your work permanently outside of this browser.
                        </p>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-emerald-600 font-bold">
                            <Upload size={18} />
                            <span>Restore (Load)</span>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            To view your project on another computer or after clearing your cache, use the green upload button to import your saved backup file.
                        </p>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-red-600 font-bold">
                            <RotateCcw size={18} />
                            <span>Reset (Factory)</span>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            Use the red reset button to wipe all local data and return the application to its default state. Warning: this cannot be undone without a backup!
                        </p>
                    </div>
                </div>
            </div>
        </div>

    );
};

export default Guide;
