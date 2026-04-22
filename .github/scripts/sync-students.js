const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 从环境变量读取配置
const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const APP_TOKEN = process.env.FEISHU_APP_TOKEN;
const TABLE_ID = process.env.FEISHU_TABLE_ID;

// 获取飞书 tenant_access_token
async function getTenantAccessToken() {
  const response = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    app_id: APP_ID,
    app_secret: APP_SECRET
  });
  
  if (response.data.code !== 0) {
    throw new Error(`获取 token 失败: ${response.data.msg}`);
  }
  return response.data.tenant_access_token;
}

// 读取飞书表格的所有记录
async function getTableRecords(accessToken) {
  let allRecords = [];
  let pageToken = null;
  let hasMore = true;

  while (hasMore) {
    const params = {
      page_size: 100,
    };
    if (pageToken) {
      params.page_token = pageToken;
    }

    const response = await axios.get(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params
      }
    );

    if (response.data.code !== 0) {
      throw new Error(`读取表格失败: ${response.data.msg}`);
    }

    const { items, has_more, page_token } = response.data.data;
    allRecords = allRecords.concat(items);
    hasMore = has_more;
    pageToken = page_token;
  }

  return allRecords;
}

// 将飞书记录转换为 students.json 格式
function convertToStudentsJson(records) {
  const students = records.map(record => {
    const fields = record.fields;
    
    // 处理 TimeWaver 原始标签（可能是字符串，也可能是数组）
    let timewaverRaw = fields['TimeWaver分析摘要'] || '';
    if (Array.isArray(timewaverRaw)) {
      timewaverRaw = timewaverRaw.join('；');
    }
    
    return {
      studentId: fields['学员ID'] || '',
      name: fields['学员姓名'] || '',
      birthDate: fields['出生日期'] || '',
      parentGoal: fields['家长当前目标'] || '',
      currentDifficulty: fields['当前困难'] || '',
      timewaverRaw: timewaverRaw,
      talentPotential: fields['天赋潜能'] || '',
      currentStudyStatus: fields['当前学习情况'] || '',
      updatedAt: fields['更新日期'] || new Date().toISOString().split('T')[0]
    };
  }).filter(student => student.name && student.birthDate); // 过滤无效记录
  
  return students;
}

async function main() {
  try {
    console.log('1. 获取飞书访问令牌...');
    const accessToken = await getTenantAccessToken();
    
    console.log('2. 读取飞书表格数据...');
    const records = await getTableRecords(accessToken);
    console.log(`   共读取 ${records.length} 条记录`);
    
    console.log('3. 转换数据格式...');
    const students = convertToStudentsJson(records);
    console.log(`   生成 ${students.length} 条学生档案`);
    
    console.log('4. 写入 students.json 文件...');
    const outputPath = path.join(process.cwd(), 'students.json');
    fs.writeFileSync(outputPath, JSON.stringify(students, null, 2), 'utf-8');
    
    console.log('✅ 同步完成！');
  } catch (error) {
    console.error('❌ 同步失败:', error.message);
    if (error.response) {
      console.error('API 响应:', error.response.data);
    }
    process.exit(1);
  }
}

main();
