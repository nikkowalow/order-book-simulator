import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { SERVER_URL } from "../config/config";

interface UserContextValue {
  userId: number | null;
}

const UserContext = createContext<UserContextValue>({ userId: null });

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function register() {
      try {
        const res = await fetch(`${SERVER_URL}/user/connect`, {
          method: "POST",
        });
        const data = await res.json();
        if (!cancelled && data.userId) {
          setUserId(data.userId);
          console.log("Registered user:", data.userId);
        }
      } catch (e) {
        console.error("Failed to register user:", e);
      }
    }

    register();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <UserContext.Provider value={{ userId }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
