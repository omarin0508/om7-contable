type AuthInputProps = {
  label: string;
  name: string;
  type?: string;
  placeholder: string;
};

export function AuthInput({
  label,
  name,
  type = "text",
  placeholder,
}: AuthInputProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <input
        className="mt-2 h-12 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10"
        name={name}
        placeholder={placeholder}
        type={type}
      />
    </label>
  );
}
