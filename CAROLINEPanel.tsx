// client/src/components/CarolinePanel.tsx
import React, { useState } from 'react';

export default function CarolinePanel() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);

    try {
      const res = await fetch('/api/caroline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${token}`,          // ← uncomment + add if your API requires auth
        },
        body: JSON.stringify({
          query: query.trim(),
          // Optional fields your backend might expect:
          // chain: selectedChainId,                   // if context-aware
          // conversationId: currentConversation?.id,
          // model: "claude-3-5-sonnet",
          // max_tokens: 1200,
          // temperature: 0.65,
        }),
      });
    
      if (!res.ok) {
        let errorMsg = `${res.status} ${res.statusText}`;
        try {
          const errBody = await res.json();
          errorMsg = errBody.message || errBody.error || errorMsg;
        } catch {}
        throw new Error(`CAROLINE backend error: ${errorMsg}`);
      }
    
      const data = await res.json();
    
      // Adapt this line to whatever your actual API returns
      // Common patterns: data.answer, data.response, data.content, data.text, data.message
      const carolineAnswer =
        data.answer ??
        data.response ??
        data.content ??
        data.text ??
        data.message ??
        '[No response content received]';
    
      setResponse(carolineAnswer);
      setQuery('');           // clear input after success
    
    } catch (err) {
      console.error('CAROLINE request failed:', err);
    
      const friendlyError =
        err instanceof Error
          ? err.message.includes('fetch') || err.message.includes('network')
            ? 'Could not reach Caroline — check your connection or try again later.'
            : err.message
          : 'Something went wrong while asking Caroline.';
    
      setResponse(`Error: ${friendlyError}`);
      // Optional: setError(friendlyError) if you have a separate error state
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-cyan-800/30">
      <h2 className="text-xl font-semibold mb-4 text-cyan-300">CAROLINE Agentic Oracle</h2>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask CAROLINE (e.g., 'Analyze Luckycoin hashrate trend' or 'Suggest bridge timing')"
            className="flex-1 bg-gray-700 border border-gray-600 rounded-md px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-md font-medium disabled:opacity-50 transition"
          >
            {loading ? 'Thinking...' : 'Ask CAROLINE'}
          </button>
        </div>
      </form>

      {response && (
        <div className="bg-gray-900 p-5 rounded border border-gray-700">
          <p className="text-gray-300 whitespace-pre-wrap">{response}</p>
        </div>
      )}
    </div>
  );
}