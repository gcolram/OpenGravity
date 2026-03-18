// Quick test for Stagehand V3 navigation
import 'dotenv/config';
import { Stagehand } from '@browserbasehq/stagehand';

async function testBrowser() {
    console.log('[TEST] Starting Stagehand V3 with correct options...');
    console.log('[TEST] OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY);

    const stagehand = new Stagehand({
        env: 'LOCAL',
        model: {
            modelName: 'gpt-4o',
            apiKey: process.env.OPENAI_API_KEY,
        },
        localBrowserLaunchOptions: { headless: false },
        verbose: 0,
        disablePino: true,
    } as any);

    try {
        await stagehand.init();
        console.log('[TEST] ✅ Init OK');

        const ctx = (stagehand as any).context;
        const pages = ctx.pages();
        console.log('[TEST] Pages in context:', pages.length);

        const page = pages.length > 0 ? pages[0] : await ctx.newPage();
        console.log('[TEST] Navigating to Wikipedia...');
        await page.goto('https://es.wikipedia.org/wiki/Rafael_Nadal', { waitUntil: 'networkidle' });
        console.log('[TEST] ✅ Title:', await page.title());

        console.log('[TEST] Testing stagehand.extract...');
        const result = await stagehand.extract('how many Roland Garros titles does Nadal have');
        console.log('[TEST] ✅ Extract result:', JSON.stringify(result));

    } catch (e: any) {
        console.error('[TEST] ❌ Error:', e.message);
        console.error(e.stack?.split('\n').slice(0, 8).join('\n'));
    } finally {
        await stagehand.close();
        console.log('[TEST] Browser closed. Done.');
    }
}

testBrowser();
