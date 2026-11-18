import { Flex, Select, Text } from "@radix-ui/themes";

const NONE = "__none";

interface Props {
  id: string;
  label: string;
  placeholder: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
}

/**
 * Radix Select with a "none" choice that maps to null (an optional FK or free-text column).
 * The menu opens right below the field, matches its width, and scrolls instead of filling the screen.
 */
export function OptionSelect({ id, label, placeholder, value, options, onChange }: Props) {
  return (
    <Flex direction="column" gap="1" style={{ minWidth: 0 }}>
      <Text as="label" htmlFor={id} size="2" weight="medium">
        {label}
      </Text>
      <Select.Root size="3" value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
        <Select.Trigger id={id} placeholder={placeholder} className="option-select-trigger" />
        <Select.Content position="popper" side="bottom" sideOffset={4} className="option-select-content">
          <Select.Item value={NONE}>{placeholder}</Select.Item>
          <Select.Separator />
          {options.map((o) => (
            <Select.Item key={o.value} value={o.value}>
              {o.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </Flex>
  );
}
