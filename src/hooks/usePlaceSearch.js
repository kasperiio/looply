import { useState, useRef, useEffect } from 'react';
import { searchPlace } from '../utils/nominatim.js';

const DEBOUNCE_MS = 500;

export function usePlaceSearch(startLabel) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (startLabel) {
      setQuery(startLabel);
      setResults([]);
      setShowResults(false);
    }
  }, [startLabel]);

  const handleQueryChange = (val) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchPlace(val);
        setResults(res);
        setShowResults(true);
      } catch {
        /* ignore */
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);
  };

  const clearResults = () => {
    setResults([]);
    setShowResults(false);
  };

  return {
    query,
    results,
    searching,
    showResults,
    handleQueryChange,
    setQuery,
    clearResults,
  };
}
