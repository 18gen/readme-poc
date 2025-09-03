import { Metadata } from 'next';
import { RepoTable } from '@/components/build/repo-table';

export const metadata: Metadata = {
  title: 'ビルド & デプロイ - README MVP',
  description: 'GitHubリポジトリを選択してビルドとデプロイを行います',
};

export default function BuildPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">ビルド & デプロイ</h1>
        <p className="text-muted-foreground">
          GitHubリポジトリを選択して、アプリケーションのビルドとデプロイを行います。
        </p>
      </div>
      
      <RepoTable />
    </div>
  );
}
