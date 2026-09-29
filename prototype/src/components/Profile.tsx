import React, { useState, useEffect } from 'react';
import { 
  Settings, Save, Landmark, Phone, Mail, MapPin, 
  ToggleLeft, ToggleRight, Info, CheckCircle, Upload
} from 'lucide-react';
import { BusinessProfile, parseAddress, formatAddress } from '../types';

interface ProfileProps {
  profile: BusinessProfile;
  onUpdateProfile: (profile: BusinessProfile) => void;
}

export default function Profile({
  profile,
  onUpdateProfile
}: ProfileProps) {
  // Local state
  const [name, setName] = useState(profile.name);
  const [logo, setLogo] = useState(profile.logo);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  
  // Structured Address fields
  const parsedAddr = parseAddress(profile.address || '');
  const [street, setStreet] = useState(parsedAddr.street);
  const [city, setCity] = useState(parsedAddr.city);
  const [province, setProvince] = useState(parsedAddr.province);
  const [postalCode, setPostalCode] = useState(parsedAddr.postalCode);
  const [country, setCountry] = useState(parsedAddr.country);
  
  // Banking details
  const [bankName, setBankName] = useState(profile.bankingDetails.bankName);
  const [accountNumber, setAccountNumber] = useState(profile.bankingDetails.accountNumber);
  const [branchCode, setBranchCode] = useState(profile.bankingDetails.branchCode);
  const [accountType, setAccountType] = useState(profile.bankingDetails.accountType);

  // VAT
  const [isVatRegistered, setIsVatRegistered] = useState(profile.isVatRegistered);
  const [vatNumber, setVatNumber] = useState(profile.vatNumber || '');
  const [vatRate, setVatRate] = useState<number | string>(profile.vatRate);

  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setLogo(profile.logo);
    setPhone(profile.phone);
    setEmail(profile.email);
    const parsed = parseAddress(profile.address || '');
    setStreet(parsed.street);
    setCity(parsed.city);
    setProvince(parsed.province);
    setPostalCode(parsed.postalCode);
    setCountry(parsed.country);
    setBankName(profile.bankingDetails.bankName);
    setAccountNumber(profile.bankingDetails.accountNumber);
    setBranchCode(profile.bankingDetails.branchCode);
    setAccountType(profile.bankingDetails.accountType);
    setIsVatRegistered(profile.isVatRegistered);
    setVatNumber(profile.vatNumber || '');
    setVatRate(profile.vatRate);
  }, [profile]);

  const getFormattedAddress = () => {
    return formatAddress({
      street,
      city,
      province,
      postalCode,
      country
    });
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newLogo = reader.result as string;
        setLogo(newLogo);
        const parsedVat = typeof vatRate === 'number' ? vatRate : (parseFloat(String(vatRate).replace(',', '.')) || 0);
        onUpdateProfile({
          name,
          logo: newLogo,
          phone,
          email,
          address: getFormattedAddress(),
          bankingDetails: {
            bankName,
            accountNumber,
            branchCode,
            accountType
          },
          isVatRegistered,
          vatNumber: isVatRegistered ? vatNumber : undefined,
          vatRate: parsedVat
        });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedVat = typeof vatRate === 'number' ? vatRate : (parseFloat(String(vatRate).replace(',', '.')) || 0);
    onUpdateProfile({
      name,
      logo,
      phone,
      email,
      address: getFormattedAddress(),
      bankingDetails: {
        bankName,
        accountNumber,
        branchCode,
        accountType
      },
      isVatRegistered,
      vatNumber: isVatRegistered ? vatNumber : undefined,
      vatRate: parsedVat
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <form onSubmit={handleFormSubmit} className="max-w-4xl mx-auto space-y-6 pb-12" id="profile-container">
      <div className="flex items-center justify-between border-b border-stone-200 pb-4">
        <div>
          <h2 className="text-lg font-bold text-stone-800">My Profile</h2>
          <p className="text-xs text-stone-500">Configure your business cards, FNB banking coordinates, and optional tax registration rules.</p>
        </div>
        <button
          type="submit"
          className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer"
        >
          <Save size={14} />
          Save Changes
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 flex items-center gap-2 text-xs">
          <CheckCircle size={16} className="text-emerald-600" />
          Business profile saved successfully! Updates are applied to all quotes and tax invoices.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Visual identity column */}
        <div className="md:col-span-1 bg-white p-6 rounded-2xl border border-stone-200 shadow-3xs space-y-4 text-center">
          <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Logo</span>
          <div className="relative mx-auto w-32 h-32 rounded-2xl overflow-hidden border border-stone-200 bg-stone-50 flex items-center justify-center">
            {logo ? (
              <img src={logo} alt="Artisan Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="text-stone-300 font-black text-4xl">M</div>
            )}
          </div>
          <div className="space-y-1">
            <input
              type="file"
              id="profileLogoUpload"
              accept="image/*"
              onChange={handleLogoChange}
              className="hidden"
            />
            <label
              htmlFor="profileLogoUpload"
              className="inline-flex items-center gap-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs px-3 py-1.5 rounded-lg cursor-pointer font-bold"
            >
              <Upload size={12} /> Upload Logo
            </label>
            <span className="text-[10px] text-stone-400 block mt-1">Appears beautifully on quotes and tax invoices.</span>
          </div>
        </div>

        {/* Business parameters */}
        <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-stone-200 shadow-3xs space-y-4">
          <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Contact & Physical Details</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Registered Business Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-stone-50 px-3 py-2 border border-stone-200 rounded-xl text-xs font-normal text-stone-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Contact Phone Cell *</label>
              <input
                type="text"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-stone-50 px-3 py-2 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Contact Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-stone-50 px-3 py-2 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none"
              />
            </div>

            {/* Structured Physical / Business Address */}
            <div className="md:col-span-2 space-y-3 pt-2 border-t border-stone-100">
              <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider">Physical Business Address</label>
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">Street Address</label>
                <input
                  type="text"
                  value={street}
                  onChange={e => setStreet(e.target.value)}
                  placeholder="e.g. Studio 12, The Salt River Sheds"
                  className="w-full bg-stone-50 px-3 py-2 border border-stone-200 rounded-xl text-xs font-normal text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="e.g. Cape Town"
                    className="w-full bg-stone-50 px-3 py-2 border border-stone-200 rounded-xl text-xs font-normal text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">Province</label>
                  <input
                    type="text"
                    value={province}
                    onChange={e => setProvince(e.target.value)}
                    placeholder="e.g. Western Cape"
                    className="w-full bg-stone-50 px-3 py-2 border border-stone-200 rounded-xl text-xs font-normal text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">Postal Code</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={e => setPostalCode(e.target.value)}
                    placeholder="e.g. 7925"
                    className="w-full bg-stone-50 px-3 py-2 border border-stone-200 rounded-xl text-xs font-normal text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={e => setCountry(e.target.value)}
                    placeholder="e.g. South Africa"
                    className="w-full bg-stone-50 px-3 py-2 border border-stone-200 rounded-xl text-xs font-normal text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Banking Coordinate Card */}
        <div className="md:col-span-3 bg-white p-6 rounded-2xl border border-stone-200 shadow-3xs space-y-4">
          <div className="flex items-center gap-2 text-stone-700">
            <Landmark size={18} className="text-amber-600" />
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Bank Details</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Bank Name *</label>
              <input
                type="text"
                required
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                className="w-full bg-stone-50 px-3 py-2 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Account Number *</label>
              <input
                type="text"
                required
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value)}
                className="w-full bg-stone-50 px-3 py-2 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none font-normal"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Branch Code *</label>
              <input
                type="text"
                required
                value={branchCode}
                onChange={e => setBranchCode(e.target.value)}
                className="w-full bg-stone-50 px-3 py-2 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Account Type *</label>
              <select
                value={accountType}
                onChange={e => setAccountType(e.target.value)}
                className="w-full bg-stone-50 px-3 py-2 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none"
              >
                <option value="Business Cheque">Business Cheque</option>
                <option value="Current Account">Current Account</option>
                <option value="Savings Account">Savings Account</option>
              </select>
            </div>
          </div>
        </div>

        {/* SARS VAT Configuration */}
        <div className="md:col-span-3 bg-white p-6 rounded-2xl border border-stone-200 shadow-3xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-50 pb-2">
            <div>
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Tax Details</span>
              <span className="text-[10px] text-stone-400 block">Required for companies with taxable supplies exceeding R1 million per annum.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-600 font-semibold">VAT Registered?</span>
              <button
                type="button"
                onClick={() => setIsVatRegistered(!isVatRegistered)}
                className="text-amber-600 focus:outline-none cursor-pointer"
              >
                {isVatRegistered ? (
                  <div className="flex items-center text-emerald-600 gap-1 font-bold text-xs"><ToggleRight size={32} /> On</div>
                ) : (
                  <div className="flex items-center text-stone-400 gap-1 font-semibold text-xs"><ToggleLeft size={32} /> Off</div>
                )}
              </button>
            </div>
          </div>

          {isVatRegistered && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Mandatory VAT Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ZA4910293847"
                  value={vatNumber}
                  onChange={e => setVatNumber(e.target.value)}
                  className="w-full bg-stone-50 px-3 py-2 border border-stone-200 rounded-xl text-xs font-normal text-stone-800 focus:outline-none"
                />
                <span className="text-[9px] text-stone-400 block mt-1">SARS Section 20 mandates this value explicitly displays on all Invoices.</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">South African standard VAT Rate (%)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={vatRate}
                  onChange={e => setVatRate(e.target.value)}
                  className="w-full bg-stone-50 px-3 py-2 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
