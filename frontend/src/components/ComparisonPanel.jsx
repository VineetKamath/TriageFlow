import React from 'react';
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
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 240, damping: 30 }}
      className="fixed bottom-0 left-0 w-full z-[2000] bg-[#0F1218] border-t border-[rgba(255,255,255,0.07)] shadow-[0_-20px_60px_rgba(0,0,0,0.6)] p-8"
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[#e8e6e0]">Impact Analysis: Response Times</h2>
          <button 
            onClick={onClose}
            className="text-[#888780] hover:text-[#e8e6e0] text-3xl font-bold leading-none"
          >
            &times;
          </button>
        </div>

        <div className="h-[250px] bg-[#141720] rounded-xl border border-[rgba(255,255,255,0.07)] p-6 mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
              <CartesianGrid strokeDasharray="1 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis type="number" stroke="rgba(255,255,255,0.2)" unit=" min" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
              <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.2)" width={150} tick={{ fill: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono' }} />
              <Tooltip 
                cursor={{ fill: '#2a2d3a', opacity: 0.4 }}
                contentStyle={{ backgroundColor: '#1a1d27', borderColor: '#2a2d3a', color: '#e8e6e0' }}
                formatter={(value) => [`${value} minutes`, 'Avg Response Time']}
              />
              <Bar dataKey="time" radius={[0, 4, 4, 0]} barSize={40}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#C94040' : '#2ECC8F'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="text-center">
          <p className="text-xl font-mono-data text-[#D4D8E0]">
            In a flood, that <span className="text-[#C94040] font-bold">7-minute gap</span> is the difference.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
