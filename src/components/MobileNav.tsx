import { Link, useLocation } from "react-router-dom";
import { Home, History, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MobileNav() {
    const location = useLocation();

    const navItems = [
        { label: "Home", icon: Home, path: "/" },
        { label: "History", icon: History, path: "/history" },
        { label: "Profile", icon: User, path: "/profile" },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-black/80 backdrop-blur-lg z-50 md:hidden pb-safe">
            <div className="flex items-center justify-around h-16">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
                                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <item.icon className={cn("h-5 w-5", isActive && "fill-current")} />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
