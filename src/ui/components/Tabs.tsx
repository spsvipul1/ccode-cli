import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  activeColor?: string;
  inactiveColor?: string;
  borderColor?: string;
  onChange?: (tabId: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeColor = 'blue',
  inactiveColor = 'gray',
  borderColor = 'gray',
  onChange
}) => {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || '');

  useInput((input, key) => {
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
    
    if (key.leftArrow && currentIndex > 0) {
      const newTab = tabs[currentIndex - 1];
      if (!newTab.disabled) {
        setActiveTab(newTab.id);
        onChange?.(newTab.id);
      }
    } else if (key.rightArrow && currentIndex < tabs.length - 1) {
      const newTab = tabs[currentIndex + 1];
      if (!newTab.disabled) {
        setActiveTab(newTab.id);
        onChange?.(newTab.id);
      }
    }
  });

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content;

  return (
    <Box flexDirection="column">
      {/* Tab headers */}
      <Box>
        {tabs.map((tab, index) => (
          <React.Fragment key={tab.id}>
            <Box
              paddingX={2}
              paddingY={0}
              borderStyle="round"
              borderColor={tab.id === activeTab ? activeColor : 'transparent'}
            >
              <Text 
                color={
                  tab.disabled ? 'gray' : 
                  tab.id === activeTab ? activeColor : inactiveColor
                }
                bold={tab.id === activeTab}
                dimColor={tab.disabled}
              >
                {tab.label}
              </Text>
            </Box>
            {index < tabs.length - 1 && <Text color={borderColor}> │ </Text>}
          </React.Fragment>
        ))}
      </Box>

      {/* Tab content border */}
      <Box>
        <Text color={borderColor}>
          {'─'.repeat(Math.max(60, tabs.reduce((acc, tab) => acc + tab.label.length + 4, 0)))}
        </Text>
      </Box>

      {/* Tab content */}
      <Box padding={1} flexGrow={1}>
        {activeTabContent}
      </Box>

      {/* Help text */}
      <Box>
        <Text color="gray" dimColor>
          Use ←→ to switch tabs
        </Text>
      </Box>
    </Box>
  );
};