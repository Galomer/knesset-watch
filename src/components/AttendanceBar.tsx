'use client';

interface Props {
  percent: number;
  label?: string;
}

export default function AttendanceBar({ percent, label }: Props) {
  const color =
    percent >= 80 ? 'bg-green-500' :
    percent >= 60 ? 'bg-yellow-500' :
    'bg-red-500';

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{label}</span>
          <span className="font-semibold">{percent}%</span>
        </div>
      )}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
