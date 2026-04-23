export function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0,10);
}

export function formatDate(str: string) {
  if (!str) return "";
  const [y,m,d] = str.split("-");
  return `${d}/${m}/${y}`;
}

export function statusBadgeClass(status: string) {
  if (!status || status === "Not Started") return "badge badge-grey";
  if (status === "In Progress" || status === "Draft") return "badge badge-blue";
  if (status === "Pending Boss’s Queue Review") return "badge badge-amber";
  if (status === "Approved") return "badge badge-green";
  if (status === "Boss’s Queue Feedback  -  Revisions Needed" || status === "Superseded") return "badge badge-red";
  if (status === "Waiting") return "badge badge-amber";
  if (status === "Boss’s Queue Responded") return "badge badge-blue";
  if (status === "Complete") return "badge badge-green";
  if (status === "On Hold") return "badge badge-grey";
  return "badge badge-grey";
}

export function fmtElapsed(secs: number) {
  if (!secs || secs <= 0) return '00:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export function fmtHHMM(date: Date) {
  return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}

export function fmtHHMMSS(secs: number) {
  if (!secs || secs <= 0) return ' - ';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
