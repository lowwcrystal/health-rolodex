import { ArrowLeftIcon } from "@radix-ui/react-icons";
import { Button } from "@radix-ui/themes";
import { useNavigate } from "react-router-dom";

interface Props {
  /** Where to go when there's no earlier page in this app (for example, the page was opened from a bookmark). */
  fallback: string;
  label?: string;
}

/** Goes to the previous page in the app's history, or to `fallback` if this is the first page visited. */
export function BackButton({ fallback, label = "Go back" }: Props) {
  const navigate = useNavigate();

  const goBack = () => {
    // React Router keeps an `idx` in history.state; 0 means this is the first entry in the app.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };

  return (
    <Button variant="ghost" color="gray" onClick={goBack} className="no-print">
      <ArrowLeftIcon /> {label}
    </Button>
  );
}
