const axios = require('axios');
const fs = require('fs');
const path = require('path');

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const APP_TOKEN = process.env.FEISHU_APP_TOKEN;
const TABLE_ID = process.env.FEISHU_TABLE_ID;

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

async function getTableRecords(accessToken) {
  let allRecords = [];
  let pageToken = null;
  let hasMore = true;

  while (hasMore) {
    const params = { page_size: 100 };
    if (pageToken) params.page_token = pageToken;

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

// 将飞书日期（时间戳）转换为 YYYY-MM-DD 格式（使用 UTC，避免时区偏移）
function formatDate(value) {
  if (!value) return '';
  
  // 如果是数字时间戳（毫秒）
  if (typeof value === 'number') {
    // 使用 UTC 方式转换，避免时区偏移
    const date = new Date(value);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // 如果已经是 YYYY-MM-DD 字符串格式
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
    return value;
  }
  
  // 尝试解析其他字符串格式
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  
  return '';
}

function convertToStudentsJson(records) {
  const students = records.map(record => {
    const fields = record.fields;
    
    // 处理 TimeWaver 原始标签
    let timewaverRaw = fields['TimeWaver分析摘要'] || '';
    if (Array.isArray(timewaverRaw)) {
      timewaverRaw = timewaverRaw.join('；');
    }
    
    const student = {
      studentId: fields['学员ID'] || '',
      name: fields['学员姓名'] || '',
      birthDate: formatDate(fields['出生日期']),
      parentGoal: fields['家长当前目标'] || '',
      currentDifficulty: fields['当前困难'] || '',
      timewaverRaw: timewaverRaw,
      talentPotential: fields['天赋潜能'] || '',
      currentStudyStatus: fields['当前学习情况'] || '',
      updatedAt: formatDate(fields['更新日期']) || new Date().toISOString().split('T')[0]
    };
    
    return student;
  }).filter(student => {
    // 过滤无效记录：必须有姓名和出生日期
    if (!student.name || !student.birthDate) {
      console.log(`⚠️ 跳过无效记录: 姓名="${student.name}", 出生日期="${student.birthDate}"`);
      return false;
    }
    return true;
  });
  
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
    
    // 打印第一条记录作为验证
    if (students.length > 0) {
      console.log('   第一条记录示例:', JSON.stringify(students[0], null, 2));
    }
    
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
