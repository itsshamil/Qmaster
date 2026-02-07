import { Link } from "react-router-dom";
import { Home, User } from "lucide-react";

interface Props {
  time: string;
  date: string;
}

export default function MobileTimerBar({ time, date }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md border-t border-neutral-100 flex items-center justify-between px-4 md:hidden z-50 pb-safe">
      <Link to="/" className="flex flex-col items-center text-neutral-600 text-[11px]">
        <Home className="h-5 w-5" />
        <span className="mt-1">Home</span>
      </Link>

      <div className="flex flex-col items-center text-center px-2">
        <div className="text-sm md:text-lg font-bold text-blue-600 tabular-nums">{time}</div>
        <div className="text-[10px] text-neutral-500 mt-0.5 truncate max-w-[120px]">{date}</div>
      </div>

      <Link to="/profile" className="flex flex-col items-center text-neutral-600 text-[11px]">
        <User className="h-5 w-5" />
        <span className="mt-1">Profile</span>
      </Link>
    </div>
  );
}
