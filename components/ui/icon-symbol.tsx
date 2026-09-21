// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  "house.fill": "home",
  "bell.fill": "notifications-none",
  "radiowaves.left": "radar",
  "info.circle.fill": "info-outline",
  "arrow.clockwise": "refresh",
  "checkmark.seal.fill": "verified",
  "checkmark.circle.fill": "check-circle",
  "circle": "radio-button-unchecked",
  "chevron.right": "chevron-right",
  "mappin.and.ellipse": "location-on",
  "calendar": "event",
  "shield.checkered": "verified-user",
  "doc.text.fill": "description",
  "person.2.fill": "people",
  "map.fill": "map",
  "lock.shield.fill": "security",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
