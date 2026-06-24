'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

const CATEGORIES = [
  'AI_LLM', 'CLOUD_INFRA', 'COMMUNICATION', 'DEV_TOOLS',
  'DESIGN', 'HOSTING', 'MONITORING', 'OTHER',
];

const CATEGORY_LABELS: Record<string, string> = {
  AI_LLM: 'AI / LLM', CLOUD_INFRA: 'Cloud Infra', COMMUNICATION: 'Communication',
  DEV_TOOLS: 'Dev Tools', DESIGN: 'Design', HOSTING: 'Hosting', MONITORING: 'Monitoring', OTHER: 'Other',
};

interface ExistingTool {
  id: string;
  name: string;
  vendor: string;
  category: string;
  paymentKind: string;
  capAmount: number;
  monthlyAmount: number;
  alertThresholdPct: number;
  triggerEmail?: string;
  renewalDate?: string | null;
}

interface Props {
  onClose: () => void;
  onCreated: (tool: any) => void;
  tool?: ExistingTool;
}

export function AddToolModal({ onClose, onCreated, tool }: Props) {
  const isEdit = !!tool;

  const [form, setForm] = useState({
    name: tool?.name ?? '',
    vendor: tool?.vendor ?? '',
    category: tool?.category ?? 'AI_LLM',
    paymentKind: tool?.paymentKind ?? 'PREPAID',
    capAmount: tool?.capAmount ? String(tool.capAmount) : '',
    monthlyAmount: tool?.monthlyAmount ? String(tool.monthlyAmount) : '',
    alertThresholdPct: tool?.alertThresholdPct ?? 80,
    triggerEmail: tool?.triggerEmail
      ? tool.triggerEmail.replace(/@life180labs\.com$/i, '')
      : '',
    renewalDate: tool?.renewalDate ? new Date(tool.renewalDate).toISOString().split('T')[0] : '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [depts, setDepts] = useState<{ id: string; name: string }[]>([]);
  useState(() => {
    api.get<any[]>('/departments').then(setDepts).catch(() => {});
  });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Tool name is required'); return; }
    if (!form.vendor.trim()) { setError('Vendor is required'); return; }
    if (!form.triggerEmail.trim()) { setError('Alert recipient is required'); return; }
    if (form.paymentKind === 'PREPAID' && !form.capAmount) { setError('Budget cap is required for Pre-paid tools'); return; }
    if (form.paymentKind === 'MOSUB' && !form.monthlyAmount) { setError('Monthly amount is required for Subscription tools'); return; }
    setError(''); setLoading(true);
    try {
      const payload = {
        name: form.name,
        vendor: form.vendor,
        category: form.category,
        paymentKind: form.paymentKind,
        capAmount: form.capAmount ? Number(form.capAmount) : undefined,
        monthlyAmount: form.monthlyAmount ? Number(form.monthlyAmount) : undefined,
        alertThresholdPct: Number(form.alertThresholdPct),
        triggerEmail: `${form.triggerEmail.trim()}@life180labs.com`,
        renewalDate: form.renewalDate ? new Date(form.renewalDate).toISOString() : undefined,
      };

      const result = isEdit
        ? await api.patch<any>(`/tools/${tool!.id}`, payload)
        : await api.post<any>('/tools', { ...payload, departmentId: depts[0]?.id });

      onCreated(result);
    } catch (err: any) {
      setError(err.message || (isEdit ? 'Failed to save changes' : 'Failed to add tool'));
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = { background: '#1B1E26', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F0F0' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#13161D', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-[#F0F0F0]">{isEdit ? 'Edit Tool' : 'Add Tool'}</h2>
          <button onClick={onClose} className="text-[#9aa0ab] hover:text-[#F0F0F0]"><X size={16} /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg text-xs text-[#F85149]" style={{ background: 'rgba(248,81,73,0.1)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#9aa0ab] mb-1.5">Tool name *</label>
              <input required value={form.name} onChange={set('name')} className="w-full px-3 py-2 text-sm rounded-lg" style={inputStyle} placeholder="OpenAI API" />
            </div>
            <div>
              <label className="block text-xs text-[#9aa0ab] mb-1.5">Vendor *</label>
              <input required value={form.vendor} onChange={set('vendor')} className="w-full px-3 py-2 text-sm rounded-lg" style={inputStyle} placeholder="OpenAI" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#9aa0ab] mb-1.5">Category *</label>
              <select required value={form.category} onChange={set('category')} className="w-full px-3 py-2 text-sm rounded-lg" style={inputStyle}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#9aa0ab] mb-1.5">Payment type *</label>
              <select required value={form.paymentKind} onChange={set('paymentKind')} className="w-full px-3 py-2 text-sm rounded-lg" style={inputStyle}>
                <option value="PREPAID">Pre-paid</option>
                <option value="MOSUB">Subscription</option>
                <option value="NOBUDGET">No budget</option>
              </select>
            </div>
          </div>

          {form.paymentKind === 'PREPAID' && (
            <div>
              <label className="block text-xs text-[#9aa0ab] mb-1.5">Budget cap (₹) *</label>
              <input required type="number" min={1} value={form.capAmount} onChange={set('capAmount')} className="w-full px-3 py-2 text-sm rounded-lg" style={inputStyle} placeholder="1000" />
            </div>
          )}

          {form.paymentKind === 'MOSUB' && (
            <div>
              <label className="block text-xs text-[#9aa0ab] mb-1.5">Monthly amount (₹) *</label>
              <input required type="number" min={1} value={form.monthlyAmount} onChange={set('monthlyAmount')} className="w-full px-3 py-2 text-sm rounded-lg" style={inputStyle} placeholder="9600" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#9aa0ab] mb-1.5">Alert threshold (%) *</label>
              <input required type="number" min={1} max={100} value={form.alertThresholdPct} onChange={set('alertThresholdPct')} className="w-full px-3 py-2 text-sm rounded-lg" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs text-[#9aa0ab] mb-1.5">Send alert to *</label>
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <input
                  required
                  type="text"
                  value={form.triggerEmail}
                  onChange={(e) => setForm({ ...form, triggerEmail: e.target.value.replace(/[@\s]/g, '') })}
                  className="flex-1 min-w-0 px-3 py-2 text-sm"
                  style={{ background: '#1B1E26', color: '#F0F0F0', border: 'none', outline: 'none' }}
                  placeholder="admin"
                />
                <span className="flex items-center px-2.5 text-xs text-[#5E6AD2] font-medium whitespace-nowrap" style={{ background: '#161924', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
                  @life180labs.com
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#9aa0ab] mb-1.5">Renewal date</label>
            <input
              type="date"
              value={form.renewalDate}
              onChange={set('renewalDate')}
              className="w-full px-3 py-2 text-sm rounded-lg"
              style={{ ...inputStyle, colorScheme: 'dark' }}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm text-[#9aa0ab] hover:text-[#F0F0F0] transition-colors" style={{ background: '#1B1E26' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2" style={{ background: '#5E6AD2', color: '#fff' }}>
              {loading && <Loader2 size={13} className="animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Tool'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
