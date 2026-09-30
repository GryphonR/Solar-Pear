import React from 'react';
import SolarPearLogo from './SolarPearLogo';

/** Read-only gate for narrow screens: what the app does, and a request to return on a wider display. */
export default function SmallScreenGate() {
    return (
        <div className="min-h-screen w-full bg-slate-100 px-4 py-6 pb-12">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <SolarPearLogo className="mx-auto h-auto w-48 text-slate-900" />
                    <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">
                        Not optimised for small screens yet
                    </h1>
                    <p className="mt-3 text-left text-sm leading-relaxed text-slate-600 sm:text-center">
                        Sorry for the inconvenience. Layout tools, databases, and the planner need a wider
                        display. Please use a laptop or desktop, or enable your browser&apos;s{' '}
                        <span className="font-semibold text-slate-800">Desktop site</span> /{' '}
                        <span className="font-semibold text-slate-800">Request desktop website</span> option so
                        this page can load the full layout.
                    </p>
                </div>
                {/* Short orientation copy rather than the full guide: the planner it describes
                    cannot be reached from this screen, so a long read would only frustrate. */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-base font-semibold text-slate-900">
                        What you&apos;ll be able to do
                    </h2>
                    <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-600">
                        <li>
                            Draw your roof and let the planner work out how many panels fit around
                            windows, vents, and other obstructions.
                        </li>
                        <li>
                            Search a large database of panels and PV controllers, or add your own
                            with your supplier&apos;s prices.
                        </li>
                        <li>
                            Check that a panel and controller pairing is safe: voltage on a freezing
                            morning, startup voltage on a hot afternoon, and whether current
                            will be clipped.
                        </li>
                        <li>
                            Get a costed summary across every roof area, and export the project as a
                            backup file.
                        </li>
                    </ul>
                    <p className="mt-4 text-xs leading-relaxed text-slate-500">
                        This tool is free and in beta. It checks compatibility rather than
                        producing a full system design, and prices are placeholders until you enter
                        your own.
                    </p>
                </div>
            </div>
        </div>
    );
}
