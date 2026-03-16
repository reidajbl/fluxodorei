import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface DashboardContextType {
  updateTrigger: number;
  forceUpdate: () => void;
}

const DashboardContext = createContext<DashboardContextType>({
  updateTrigger: 0,
  forceUpdate: () => {},
});

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [updateTrigger, setUpdateTrigger] = useState(0);

  const forceUpdate = useCallback(() => {
    console.log("🔄 Forçando atualização global do dashboard");
    setUpdateTrigger((prev) => prev + 1);
  }, []);

  return (
    <DashboardContext.Provider value={{ updateTrigger, forceUpdate }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => useContext(DashboardContext);
