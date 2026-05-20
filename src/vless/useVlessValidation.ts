import { useCallback, useState } from 'react';
import { parseVlessShareLink, VlessShare } from '../utils/vless-share';

interface UseVlessValidationReturn {
  input: string;
  parsedResult: VlessShare | null;
  error: string | null;
  isValidating: boolean;
  validate: (link: string) => void;
  clear: () => void;
}

export function useVlessValidation(): UseVlessValidationReturn {
  const [input, setInput] = useState('');
  const [parsedResult, setParsedResult] = useState<VlessShare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const validate = useCallback((link: string) => {
    setInput(link);
    setIsValidating(true);
    setError(null);
    setParsedResult(null);

    const trimmed = link.trim();
    if (!trimmed) {
      setIsValidating(false);
      return;
    }

    try {
      const result = parseVlessShareLink(trimmed);
      setParsedResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsValidating(false);
    }
  }, []);

  const clear = useCallback(() => {
    setInput('');
    setParsedResult(null);
    setError(null);
    setIsValidating(false);
  }, []);

  return { input, parsedResult, error, isValidating, validate, clear };
}
