"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, GitBranch, Lock, Globe, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface GitHubRepo {
  id: number;
  name: string;
  owner: {
    login: string;
  };
  private: boolean;
  default_branch: string;
  updated_at: string;
}

export function RepoTable() {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<GitHubRepo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'updated'>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();

  useEffect(() => {
    fetchRepos();
  }, []);

  useEffect(() => {
    filterAndSortRepos();
  }, [repos, searchTerm, sortBy, sortOrder]);

  const fetchRepos = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/github/repos", {
        credentials: "same-origin",
        headers: { "accept": "application/json" },
      });
      if (response.status === 401) {
        setError("Unauthorized. Please sign in with GitHub (with repo scope).");
        setLoading(false);
        return;
      }
      if (!response.ok) throw new Error("Failed to fetch repositories");      
      
      const data = await response.json();
      setRepos(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortRepos = () => {
    let filtered = repos.filter(repo => 
      repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repo.owner.login.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let aValue: string | Date;
      let bValue: string | Date;

      if (sortBy === 'name') {
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
      } else {
        aValue = new Date(a.updated_at);
        bValue = new Date(b.updated_at);
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredRepos(filtered);
  };

  const handleSort = (field: 'name' | 'updated') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleRepoSelect = (owner: string, repo: string) => {
    router.push(`/build/${owner}/${repo}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">リポジトリを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={fetchRepos} variant="outline">
            再試行
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="リポジトリ名またはオーナーで検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={sortBy === 'name' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSort('name')}
          >
            名前 {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
          </Button>
          <Button
            variant={sortBy === 'updated' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSort('updated')}
          >
            更新日 {sortBy === 'updated' && (sortOrder === 'asc' ? '↑' : '↓')}
          </Button>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        {filteredRepos.length} 件のリポジトリが見つかりました
      </div>

      {/* Repository Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>リポジトリ</TableHead>
              <TableHead>オーナー</TableHead>
              <TableHead>ブランチ</TableHead>
              <TableHead>更新日</TableHead>
              <TableHead className="text-right">アクション</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRepos.map((repo) => (
              <TableRow key={repo.id} className="hover:bg-muted/50">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {repo.private ? (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Globe className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">{repo.name}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground">@{repo.owner.login}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{repo.default_branch}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{formatDate(repo.updated_at)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    onClick={() => handleRepoSelect(repo.owner.login, repo.name)}
                  >
                    選択
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredRepos.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          リポジトリが見つかりませんでした
        </div>
      )}
    </div>
  );
}
