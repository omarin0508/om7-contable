export type KPI = {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  detail: string;
};

export type Movement = {
  company: string;
  category: string;
  amount: string;
  status: "Conciliado" | "Pendiente" | "Revision";
  date: string;
};

export type Alert = {
  title: string;
  description: string;
  priority: "Alta" | "Media" | "Baja";
};
