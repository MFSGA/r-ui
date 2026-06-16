import { createContext, useContext, useState, type ReactNode } from 'react';

interface AccordionCollapseContextType {
  collapsedAll: boolean;
  setCollapsedAll: (v: boolean) => void;
}

const AccordionCollapseContext = createContext<AccordionCollapseContextType>({
  collapsedAll: false,
  setCollapsedAll: () => {},
});

export function AccordionCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsedAll, setCollapsedAll] = useState(false);
  return (
    <AccordionCollapseContext.Provider value={{ collapsedAll, setCollapsedAll }}>
      {children}
    </AccordionCollapseContext.Provider>
  );
}

export function useAccordionCollapse() {
  return useContext(AccordionCollapseContext);
}
