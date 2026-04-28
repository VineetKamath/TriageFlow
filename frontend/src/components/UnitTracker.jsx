import React from 'react';

export default function UnitTracker({ units }) {
  // Sort: deployed first, then en_route, then available
  const sortedUnits = [...(units || [])].sort((a, b) => {
    const order = { deployed: 0, en_route: 1, available: 2 };
    return order[a.status] - order[b.status];
  });

  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-[#e8e6e0] mb-3">Unit Tracker</h2>
      <div className="bg-[#0F1218] border border-[rgba(255,255,255,0.07)] rounded-xl p-0 overflow-hidden mb-4">
        <div className="max-h-[300px] overflow-y-auto">
          <table className="w-full text-left text-sm text-[#e8e6e0]">
            <thead className="sticky top-0 px-4 py-3 border-b border-white/5 text-xs font-mono-data uppercase tracking-widest text-white/30 bg-black/30">
              <tr>
                <th className="py-2 px-4 font-medium">Unit ID</th>
                <th className="py-2 px-4 font-medium">Current Zone</th>
                <th className="py-2 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2d3a]">
              {sortedUnits.map((u) => {
                const statusClass = u.status === 'available'
                  ? 'bg-[#101E18] text-[#2ECC8F] border border-[rgba(46,204,143,0.4)]'
                  : u.status === 'en_route'
                    ? 'bg-[#1E1A10] text-[#D4860A] border border-[rgba(212,134,10,0.4)]'
                    : 'bg-[#1E1414] text-[#C94040] border border-[rgba(201,64,64,0.4)]';
                return (
                <tr key={u.id} className="hover:bg-white/3 transition-colors duration-100">
                  <td className="py-2 px-4 text-sm text-white/70 font-mono-data">Unit {u.id}</td>
                  <td className="py-2 px-4 text-sm text-white/70 font-mono-data">Zone {u.zone_id}</td>
                  <td className="py-2 px-4">
                    <span className={`text-[10px] font-mono-data px-2 py-[2px] rounded-[2px] ${statusClass}`}>
                      {u.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              )})}
              {sortedUnits.length === 0 && (
                <tr>
                  <td colSpan="3" className="py-4 text-center text-[#888780]">No units available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
