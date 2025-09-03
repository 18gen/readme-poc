"use client";

import { useState, useEffect } from 'react';
import { Plus, Trash2, Eye, EyeOff, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface EnvironmentVariable {
  id: string;
  key: string;
  createdAt: string;
  updatedAt: string;
}

interface EnvEditorProps {
  projectId: string;
  envs: EnvironmentVariable[];
  onEnvUpdate: () => void;
}

interface EnvItem {
  id?: string;
  key: string;
  value: string;
  isNew: boolean;
  isRevealed: boolean;
}

export function EnvEditor({ projectId, envs, onEnvUpdate }: EnvEditorProps) {
  const [envItems, setEnvItems] = useState<EnvItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Initialize env items from existing envs
    const items: EnvItem[] = envs.map(env => ({
      id: env.id,
      key: env.key,
      value: '********',
      isNew: false,
      isRevealed: false
    }));
    setEnvItems(items);
  }, [envs]);

  const addNewEnv = () => {
    setEnvItems(prev => [...prev, {
      key: '',
      value: '',
      isNew: true,
      isRevealed: true
    }]);
  };

  const removeEnv = (index: number) => {
    setEnvItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateEnvItem = (index: number, field: 'key' | 'value', value: string) => {
    setEnvItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const toggleReveal = async (index: number) => {
    const item = envItems[index];
    if (!item.isNew && item.id) {
      try {
        const response = await fetch(`/api/project/env?projectId=${projectId}&key=${item.key}`);
        if (response.ok) {
          const { value } = await response.json();
          setEnvItems(prev => prev.map((env, i) => 
            i === index ? { ...env, value, isRevealed: true } : env
          ));
        }
      } catch (error) {
        console.error('Failed to reveal value:', error);
      }
    } else {
      setEnvItems(prev => prev.map((env, i) => 
        i === index ? { ...env, isRevealed: !env.isRevealed } : env
      ));
    }
  };

  const saveEnvs = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Prepare items for API
      const items = envItems.map(item => ({
        key: item.key,
        value: item.isNew ? item.value : (item.isRevealed ? item.value : null)
      }));

      const response = await fetch('/api/project/env', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          items
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save environment variables');
      }

      setSuccess('環境変数が保存されました');
      onEnvUpdate();
      
      // Reset form
      setEnvItems(envs.map(env => ({
        id: env.id,
        key: env.key,
        value: '********',
        isNew: false,
        isRevealed: false
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = () => {
    return envItems.some(item => 
      item.isNew || 
      (item.isRevealed && item.value !== '********')
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">環境変数</h3>
          <p className="text-sm text-muted-foreground">
            アプリケーションの環境変数を設定します。値は暗号化して保存されます。
          </p>
        </div>
        <Button onClick={addNewEnv} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          追加
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      <div className="space-y-3">
        {envItems.map((item, index) => (
          <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
            <div className="flex-1">
              <Input
                placeholder="環境変数名 (例: DATABASE_URL)"
                value={item.key}
                onChange={(e) => updateEnvItem(index, 'key', e.target.value)}
                className="mb-2"
              />
              <div className="flex items-center gap-2">
                <Input
                  type={item.isRevealed ? 'text' : 'password'}
                  placeholder="値"
                  value={item.value}
                  onChange={(e) => updateEnvItem(index, 'value', e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toggleReveal(index)}
                >
                  {item.isRevealed ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => removeEnv(index)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {envItems.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
          <p>環境変数が設定されていません</p>
          <p className="text-sm">「追加」ボタンをクリックして環境変数を設定してください</p>
        </div>
      )}

      {hasChanges() && (
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">変更あり</Badge>
            <span className="text-sm text-muted-foreground">
              環境変数に変更があります。保存してください。
            </span>
          </div>
          <Button onClick={saveEnvs} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? '保存中...' : '保存'}
          </Button>
        </div>
      )}
    </div>
  );
}
