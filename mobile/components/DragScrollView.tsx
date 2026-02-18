/**
 * Native: passthrough. Scroll and drag-to-scroll are handled by ScrollView/FlatList.
 * Web: use DragScrollView.web.tsx for wheel + click-and-drag scroll.
 */

import { ScrollView, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

export default function DragScrollView({
  children,
  style,
  contentContainerStyle,
  testID,
}: Props) {
  return (
    <ScrollView
      testID={testID}
      style={style}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator
    >
      {children}
    </ScrollView>
  );
}
