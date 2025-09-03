"use client";

import { useState, useEffect, useRef } from 'react';
import { ScrollText, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface LogViewerProps {
  buildId: string;
}

interface BuildStatus {
  status: string;
  logs: string;
  deployment?: {
    id: string;
    status: string;
    pid?: number;
    hostPort?: number;
  };
}

export function LogViewer({ buildId }: LogViewerProps) {
  const [logs, setLogs] = useState<string>('');
  const [status, setStatus] = useState<string>('QUEUED');
  const [deployment, setDeployment] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    connectToEventSource();
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [buildId]);

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const connectToEventSource = () => {
    try {
      const eventSource = new EventSource(`/api/builds/${buildId}/stream`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnected(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        // Handle keepalive
        if (event.data === ':') {
          return;
        }
      };

      eventSource.addEventListener('status', (event) => {
        try {
          const data: BuildStatus = JSON.parse(event.data);
          setStatus(data.status);
          setLogs(data.logs || '');
          if (data.deployment) {
            setDeployment(data.deployment);
          }
        } catch (error) {
          console.error('Failed to parse status event:', error);
        }
      });

      eventSource.addEventListener('log', (event) => {
        try {
          const data = JSON.parse(event.data);
          setLogs(prev => prev + '\n' + data.message);
        } catch (error) {
          console.error('Failed to parse log event:', error);
        }
      });

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        setConnected(false);
        setError('ログストリームの接続に失敗しました');
        eventSource.close();
      };
    } catch (error) {
      console.error('Failed to create EventSource:', error);
      setError('ログストリームの接続に失敗しました');
    }
  };

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const copyLogs = async () => {
    try {
      await navigator.clipboard.writeText(logs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy logs:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'QUEUED':
        return <Badge variant="secondary">キュー中</Badge>;
      case 'RUNNING':
        return <Badge variant="default">実行中</Badge>;
      case 'SUCCEEDED':
        return <Badge variant="default" className="bg-green-500">成功</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">失敗</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatLogs = (logText: string) => {
    if (!logText) return '';
    
    return logText
      .split('\n')
      .map((line, index) => {
        if (line.startsWith('[ERROR]')) {
          return (
            <div key={index} className="text-red-500 font-mono text-sm">
              {line}
            </div>
          );
        }
        if (line.startsWith('[STDOUT]')) {
          return (
            <div key={index} className="text-green-600 font-mono text-sm">
              {line}
            </div>
          );
        }
        if (line.startsWith('[STDERR]')) {
          return (
            <div key={index} className="text-yellow-600 font-mono text-sm">
              {line}
            </div>
          );
        }
        return (
          <div key={index} className="text-gray-700 font-mono text-sm">
            {line}
          </div>
        );
      });
  };

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5" />
          <span className="font-medium">ビルドログ</span>
          {getStatusBadge(status)}
        </div>
        
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-muted-foreground">
            {connected ? '接続中' : '切断'}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={copyLogs}
            disabled={!logs}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Connection Error */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={connectToEventSource}
            className="mt-2"
          >
            再接続
          </Button>
        </div>
      )}

      {/* Logs Display */}
      <div className="border rounded-lg bg-gray-50 p-4 h-96 overflow-y-auto">
        {logs ? (
          <div className="space-y-1">
            {formatLogs(logs)}
            <div ref={logsEndRef} />
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>ログが表示されるまでお待ちください...</p>
          </div>
        )}
      </div>

      {/* Auto-scroll Info */}
      <div className="text-xs text-muted-foreground text-center">
        ログは自動的に最新の位置にスクロールされます
      </div>
    </div>
  );
}
