import { Flex, Text, TextField } from "@radix-ui/themes";
import type { ComponentProps, ReactNode } from "react";

type InputProps = Omit<ComponentProps<typeof TextField.Root>, "onChange" | "value">;

interface Props extends InputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
}

/** Label + Radix TextField + inline error. Pass maxLength from MAX_LEN (types/schema.ts). */
export function FormField({ id, label, value, onChange, error, hint, optional, ...input }: Props) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <Flex direction="column" gap="1">
      <Text as="label" htmlFor={id} size="2" weight="medium">
        {label}
        {optional && (
          <Text color="gray" weight="regular">
            {" "}
            (optional)
          </Text>
        )}
      </Text>
      <TextField.Root
        id={id}
        name={id}
        size="3"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        color={error ? "red" : undefined}
        {...input}
      />
      {error ? (
        <Text id={`${id}-error`} size="1" color="red">
          {error}
        </Text>
      ) : hint ? (
        <Text id={`${id}-hint`} size="1" color="gray">
          {hint}
        </Text>
      ) : null}
    </Flex>
  );
}
