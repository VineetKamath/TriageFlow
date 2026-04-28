import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

export default function ComparisonPanel({ isOpen, onClose }) {
  if (!isOpen) return null;

  const data = [
    { name: 'Without TriageFlow', time: 11, color: '#E24B4A' },
    { name: 'With TriageFlow', time: 4, color: '#1D9E75' },
  ];

  return (
    <motion.div
      initial={{ x: 420, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 420, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 30 }}
      className="fixed top-0 right-0 h-full w-[420px] z-[3000] bg-white border-l border-[rgba(99,120,160,0.15)] shadow-[-20px_0_60px_rgba(0,0,0,0.18)] p-6 overflow-y-auto"
    >
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-[#1C2B4A]">Impact Analysis: Response Times</h2>
          <button 
            onClick={onClose}
            className="text-[#9AA3B0] hover:text-[#1C2B4A] text-2xl font-bold leading-none"
          >
            &times;
          </button>
        </div>

        <div className="h-[250px] bg-[#F8FAFF] rounded-xl border border-[rgba(99,120,160,0.15)] p-4 mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
              <CartesianGrid strokeDasharray="1 4" stroke="rgba(99,120,160,0.14)" vertical={false} />
              <XAxis type="number" stroke="rgba(99,120,160,0.35)" unit=" min" tick={{ fill: 'rgba(95,107,124,0.9)', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
              <YAxis dataKey="name" type="category" stroke="rgba(99,120,160,0.35)" width={150} tick={{ fill: 'rgba(95,107,124,0.9)', fontFamily: 'JetBrains Mono' }} />
              <Tooltip 
                cursor={{ fill: '#EEF3FF', opacity: 0.55 }}
                contentStyle={{ backgroundColor: '#ffffff', borderColor: 'rgba(99,120,160,0.25)', color: '#1C2B4A' }}
                formatter={(value) => [`${value} minutes`, 'Avg Response Time']}
              />
              <Bar dataKey="time" radius={[0, 4, 4, 0]} barSize={40}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#D93025' : '#1E8E6E'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="text-center">
          <p className="text-sm font-mono text-[#5F6B7C]">
            In a flood, that <span className="text-[#D93025] font-bold">7-minute gap</span> is the difference.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
