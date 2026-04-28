export default function UnitTracker({ units }) {
  // Sort: deployed first, then en_route, then available
  const sortedUnits = [...(units || [])].sort((a, b) => {
    const order = { deployed: 0, en_route: 1, available: 2 };
    return order[a.status] - order[b.status];
  });
  const total = sortedUnits.length;
  const available = sortedUnits.filter((u) => u.status === 'available').length;

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-[#1C2B4A]">Unit Tracker</h2>
        <div className="text-[10px] font-mono text-[#5F6B7C]">
          ({available} available / {total} total)
        </div>
      </div>
      <div className="bg-white border border-[rgba(99,120,160,0.15)] rounded-xl p-0 overflow-hidden shadow-sm flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto">
          <table className="w-full text-left text-sm text-[#1C2B4A]">
            <thead className="sticky top-0 px-4 py-3 border-b border-[rgba(99,120,160,0.15)] text-xs font-mono uppercase tracking-widest text-[#5F6B7C] bg-[#F8FAFF]">
              <tr>
                <th className="py-2 px-4 font-medium">Unit ID</th>
                <th className="py-2 px-4 font-medium">Current Zone</th>
                <th className="py-2 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(99,120,160,0.12)]">
              {sortedUnits.map((u) => {
                const statusClass = u.status === 'available'
                  ? 'bg-[#E6F4EA] text-[#1E8E6E] border border-[rgba(30,142,110,0.35)]'
                  : u.status === 'en_route'
                    ? 'bg-[#FFF3E0] text-[#E37400] border border-[rgba(227,116,0,0.35)]'
                    : 'bg-[#FEE8E7] text-[#D93025] border border-[rgba(217,48,37,0.35)]';
                return (
                <tr key={u.id} className="hover:bg-[#F8FAFF] transition-colors duration-100">
                  <td className="py-2 px-4 text-sm text-[#1C2B4A] font-mono">Unit {u.id}</td>
                  <td className="py-2 px-4 text-sm text-[#1C2B4A] font-mono">Zone {u.zone_id}</td>
                  <td className="py-2 px-4">
                    <span className={`text-[10px] font-mono px-2 py-[2px] rounded-[4px] ${statusClass}`}>
                      {u.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              )})}
              {sortedUnits.length === 0 && (
                <tr>
                  <td colSpan="3" className="py-8 text-center text-[#5F6B7C] font-mono text-xs">No units available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
