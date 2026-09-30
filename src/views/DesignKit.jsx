import React, { useState } from 'react';
import SolarPearLogo from '../components/SolarPearLogo';
import { StatusPill, SlotCard, Meter, SidePanel, EmptyState, FilterBar, FilterButton, STATUS, Toast } from '../components/ui';

/** Component gallery for the UX overhaul (development only: open with `?kit`). Every component in every state. */
export default function DesignKit() {
    const [panelOpen, setPanelOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [priced, setPriced] = useState(true);
    const [toast, setToast] = useState(false);

    const Heading = ({ children }) => (
        <h2 className="mb-3 text-[13px] font-semibold tracking-[0.1em] text-subtle uppercase">{children}</h2>
    );

    return (
        <div className="ui-next flex h-full font-plex text-body">
            <div className="min-w-0 flex-1 overflow-y-auto bg-paper p-8">
                <div className="mx-auto flex max-w-5xl flex-col gap-10">
                    <header className="flex items-center gap-6">
                        <div className="rounded-lg bg-ink px-6 py-3">
                            <SolarPearLogo className="h-12 w-auto text-slate-100" />
                        </div>
                        <SolarPearLogo mark className="h-12 w-auto" />
                        <h1 className="text-3xl leading-9 font-semibold">Component kit</h1>
                    </header>

                    <section>
                        <Heading>Status</Heading>
                        <div className="flex flex-col gap-2.5 text-[13px]">
                            {Object.entries(STATUS).map(([key, { description }]) => (
                                <div key={key} className="flex items-center gap-3">
                                    <StatusPill status={key} className="w-28" />
                                    <span>{description}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section>
                        <Heading>Slot card: empty, filled, needs attention</Heading>
                        <div className="grid grid-cols-3 gap-3.5">
                            <SlotCard eyebrow="2 · Panel" title="Choose a panel" detail="Ranked for this roof and controller." onAction={() => {}} />
                            <SlotCard eyebrow="2 · Panel" state="filled" title="LONGi Hi-MO 6 430 W" detail="£84.88 each" onAction={() => {}} />
                            <SlotCard eyebrow="3 · Controller" state="attention" title="ECCO 6kW · MPPT 2" detail="1 warning" onAction={() => {}} />
                        </div>
                    </section>

                    <section className="grid grid-cols-2 gap-8">
                        <div>
                            <Heading>Meter</Heading>
                            <div className="flex flex-col gap-4 rounded-[10px] border border-line bg-white p-5">
                                <Meter label="DC input power, all ports" value={6450} max={7800} />
                                <Meter label="Over the limit" value={9000} max={7800} />
                                <Meter label="Unpublished limit" value={500} max={0} />
                            </div>
                        </div>
                        <div>
                            <Heading>Actions and toast</Heading>
                            <div className="flex flex-wrap gap-2.5">
                                <button type="button" className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-ink">Primary</button>
                                <button type="button" className="h-10 rounded-md border border-line-strong bg-white px-4 text-sm font-semibold">Secondary</button>
                                <button type="button" className="h-10 rounded-md border border-status-error-edge bg-white px-4 text-sm font-semibold text-status-error-edge">Delete…</button>
                                <button type="button" onClick={() => setToast(true)} className="h-10 rounded-md border border-line-strong bg-white px-4 text-sm font-semibold">Show undo toast</button>
                                <button type="button" onClick={() => setPanelOpen(true)} className="h-10 rounded-md border border-line-strong bg-white px-4 text-sm font-semibold">Open side panel</button>
                            </div>
                        </div>
                    </section>

                    <section>
                        <Heading>Filter bar</Heading>
                        <FilterBar search={search} onSearch={setSearch} searchLabel="Search panels" placeholder="Search model or series" shown={8} total={183} onClear={() => { setSearch(''); setPriced(false); }}>
                            <FilterButton popup>Manufacturer</FilterButton>
                            <FilterButton popup active>Power: 420–450 W</FilterButton>
                            <FilterButton pressed={priced} active={priced} onClick={() => setPriced((v) => !v)}>Has a price</FilterButton>
                        </FilterBar>
                    </section>

                    <section className="max-w-sm">
                        <Heading>Empty state</Heading>
                        <EmptyState title="Add a system" action={{ label: 'Add a system', onClick: () => {} }}>
                            A separate installation with its own controllers, like a barn or a second consumer unit.
                        </EmptyState>
                    </section>
                </div>
            </div>
            <SidePanel open={panelOpen} onClose={() => setPanelOpen(false)} title="Add a controller for Garage roof">
                <p className="p-5 text-sm text-subtle">Escape or the close button dismisses this panel and returns focus to the button that opened it.</p>
            </SidePanel>
            {toast ? <Toast message="East roof removed" variant="dark" action={{ label: 'Undo', onClick: () => {} }} onClose={() => setToast(false)} /> : null}
        </div>
    );
}
