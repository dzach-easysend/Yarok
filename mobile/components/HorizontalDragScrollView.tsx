/**
 * Native: passthrough ScrollView horizontal. Touch drag works natively.
 * Web: use HorizontalDragScrollView.web.tsx for mouse click-and-drag scroll.
 */

import { ScrollView, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

export default function HorizontalDragScrollView({
  children,
  style,
  contentContainerStyle,
  testID,
}: Props) {
  return (
    <ScrollView
      testID={testID}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
      contentContainerStyle={contentContainerStyle}
    >
      {children}
    </ScrollView>
  );
}
