import React, { useState } from 'react';
import { useInput } from 'ink';
import { Box } from './Box.js';
import { Text } from './Text.js';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  onChange?: (tabId: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, onChange }) => {
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
      <Box>
        {tabs.map((tab, index) => (
          <React.Fragment key={tab.id}>
            <Box
              paddingX={2}
              paddingY={0}
              borderStyle="round"
              borderColor={tab.id === activeTab ? 'primary' : 'transparent'}
            >
              <Text
                color={tab.disabled ? 'textSecondary' : tab.id === activeTab ? 'primary' : 'textSecondary'}
                bold={tab.id === activeTab}
                dimColor={tab.disabled}
              >
                {tab.label}
              </Text>
            </Box>
            {index < tabs.length - 1 && <Text color="border"> │ </Text>}
          </React.Fragment>
        ))}
      </Box>
      <Box>
        <Text color="border">
          {'─'.repeat(Math.max(60, tabs.reduce((acc, tab) => acc + tab.label.length + 4, 0)))}
        </Text>
      </Box>
      <Box padding={1} flexGrow={1}>
        {activeTabContent}
      </Box>
      <Box>
        <Text color="textSecondary" dimColor>
          Use ←→ to switch tabs
        </Text>
      </Box>
    </Box>
  );
};
