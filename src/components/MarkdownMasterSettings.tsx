import React from 'react';
import { Switch, Select, Button, Input, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';

interface MarkdownMasterSettingsProps {
  // 定义必要的props和回调函数
}

export function MarkdownMasterSettings({ /* props */ }: MarkdownMasterSettingsProps) {
  return (
    <div className="markdown-master-settings">
      <h2>Markdown Master 设置</h2>
      
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">常规</TabsTrigger>
          <TabsTrigger value="formatting">格式化</TabsTrigger>
          <TabsTrigger value="advanced">高级</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <section>
            <h3>自动格式化</h3>
            <div className="setting-item">
              <Switch 
                label="打开文件时自动格式化" 
                description="每次打开Markdown文件时自动应用格式化规则"
              />
            </div>
            <div className="setting-item">
              <Switch 
                label="保存时自动格式化" 
                description="每次保存Markdown文件时自动应用格式化规则"
              />
            </div>
          </section>

          <section>
            <h3>格式化模板</h3>
            <div className="setting-item">
              <Select 
                label="选择预设模板"
                options={[
                  { value: 'default', label: '默认' },
                  { value: 'technical', label: '技术文档' },
                  { value: 'blog', label: '博客文章' },
                  { value: 'academic', label: '学术论文' },
                ]}
              />
            </div>
          </section>
        </TabsContent>

        <TabsContent value="formatting">
          <section>
            <h3>标题格式化</h3>
            <div className="setting-item">
              <Switch 
                label="启用标题转换" 
                description="允许在不同级别的标题之间进行转换"
              />
              <div className="header-conversion">
                <Select 
                  label="源标题级别"
                  options={[
                    { value: 'h1', label: '一级标题 (#)' },
                    { value: 'h2', label: '二级标题 (##)' },
                    { value: 'h3', label: '三级标题 (###)' },
                    { value: 'h4', label: '四级标题 (####)' },
                    { value: 'h5', label: '五级标题 (#####)' },
                    { value: 'h6', label: '六级标题 (######)' },
                  ]} 
                />
                <Select 
                  label="目标标题级别"
                  options={[
                    { value: 'h1', label: '一级标题 (#)' },
                    { value: 'h2', label: '二级标题 (##)' },
                    { value: 'h3', label: '三级标题 (###)' },
                    { value: 'h4', label: '四级标题 (####)' },
                    { value: 'h5', label: '五级标题 (#####)' },
                    { value: 'h6', label: '六级标题 (######)' },
                  ]} 
                />
              </div>
              <Switch 
                label="递归转换子标题" 
                description="同时转换所选标题下的所有子标题"
              />
            </div>
          </section>

          <section>
            <h3>列表格式化</h3>
            <div className="setting-item">
              <Switch 
                label="统一列表样式" 
                description="使用一致的列表符号和缩进"
              />
              <Select 
                label="列表符号"
                options={[
                  { value: '-', label: '破折号 (-)' },
                  { value: '*', label: '星号 (*)' },
                  { value: '+', label: '加号 (+)' },
                ]}
              />
              <Input 
                type="number"
                label="缩进空格数"
                min={2}
                max={8}
                step={2}
              />
            </div>
          </section>

          <section>
            <h3>链接处理</h3>
            <div className="setting-item">
              <Switch 
                label="清理无效链接" 
                description="删除或标记失效的URL"
              />
              <Switch 
                label="统一链接样式" 
                description="将所有链接转换为指定格式"
              />
              <Select 
                label="链接样式"
                options={[
                  { value: 'inline', label: '内联链接 [文本](URL)' },
                  { value: 'reference', label: '引用链接 [文本][1]' },
                ]}
              />
            </div>
          </section>

          <section>
            <h3>符号处理</h3>
            <div className="setting-item">
              <Switch 
                label="删除特定符号" 
                description="删除用户指定的特定符号"
              />
              <Input 
                label="要删除的符号"
                placeholder="输入要删除的符号，用逗号分隔"
                description="例如：@,#,$,%"
              />
              <Switch 
                label="保留符号前后的空格" 
                description="删除符号时保留其前后的空格"
              />
            </div>
          </section>
        </TabsContent>

        <TabsContent value="advanced">
          <section>
            <h3>自定义规则</h3>
            <div className="setting-item">
              <label>自定义正则表达式规则</label>
              <textarea 
                placeholder="每行一个规则，格式：正则表达式||替换内容"
                rows={6}
              />
            </div>
          </section>

          <section>
            <h3>导入/导出</h3>
            <div className="setting-item">
              <Button>导出设置</Button>
              <Button>导入设置</Button>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
