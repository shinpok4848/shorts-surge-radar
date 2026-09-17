class b extends Error{reason;constructor(e,t){super(e);this.reason=t;this.name="YouTubeApiError"}}function X(e){return{KR:"ko",US:"en",JP:"ja",GB:"en"}[e]}function w(e){let t=Number(e??0);return Number.isFinite(t)?t:0}function Q(e){let t=e.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);if(!t)return 0;return Number(t[1]??0)*3600+Number(t[2]??0)*60+Number(t[3]??0)}function W(e){let t=e.snippet.thumbnails??{},a=t.maxres?.url??t.standard?.url??t.high?.url??t.medium?.url??t.default?.url??"";return{videoId:e.id,title:e.snippet.title,channelTitle:e.snippet.channelTitle,publishedAt:e.snippet.publishedAt,description:e.snippet.description??"",thumbnailUrl:a,durationSeconds:Q(e.contentDetails.duration),views:w(e.statistics?.viewCount),likes:w(e.statistics?.likeCount),comments:w(e.statistics?.commentCount),tags:e.snippet.tags??[],hasCaptions:e.contentDetails.caption==="true"}}async function D(e,t){let a=await fetch(`https://www.googleapis.com/youtube/v3/${e}?${t.toString()}`),r=await a.json();if(!a.ok||r.error){let n=r.error?.errors?.[0]?.reason,o=a.status===403?"API 키 권한 또는 YouTube Data API 할당량을 확인해 주세요.":"YouTube 데이터를 불러오지 못했습니다.";throw new b(r.error?.message??o,n)}return r}async function A(e,t){if(t.length===0)return[];let a=[];for(let n=0;n<t.length;n+=50)a.push(t.slice(n,n+50));return(await Promise.all(a.map(async(n)=>{let o=new URLSearchParams({key:e,part:"snippet,contentDetails,statistics",id:n.join(","),maxResults:"50"});return((await D("videos",o)).items??[]).map(W)}))).flat().filter((n)=>n.durationSeconds>0&&n.durationSeconds<=180)}async function $(e,t){let a=new Date(Date.now()-t.periodHours*60*60*1000).toISOString(),r=t.query.trim(),n=r?`${r} #shorts`:"#shorts",o=new URLSearchParams({key:e,part:"snippet",type:"video",videoDuration:"short",order:"viewCount",maxResults:"50",regionCode:t.region,relevanceLanguage:X(t.region),publishedAfter:a,q:n}),p=((await D("search",o)).items??[]).map((s)=>s.id.videoId).filter((s)=>Boolean(s));return A(e,p)}function _(e,t=0,a=1){return Math.min(a,Math.max(t,e))}function C(e){return Number.isFinite(e)?e:0}function O(e,t,a=Date.now()){let r=e.map((o)=>{let i=t.get(o.videoId),p=Math.max(0.08333333333333333,(a-Date.parse(o.publishedAt))/3600000),s=i?Math.max(0.016666666666666666,(a-i.capturedAt)/3600000):0,c=i?Math.max(0,o.views-i.views):0,f=o.views/p,I=i?c/s:f,S=o.views>0?(o.likes+o.comments*2)/o.views:0;return{...o,velocity:C(I),viewDelta:c,engagementRate:C(S),dataQuality:i?"observed":"estimated",previousCapturedAt:i?.capturedAt,ageHours:p}}),n=Math.max(1,...r.map((o)=>Math.log10(o.velocity+1)));return r.map((o)=>{let i=Math.log10(o.velocity+1)/n,p=Math.exp(-o.ageHours/72),s=_(o.engagementRate/0.12),c=o.dataQuality==="observed"?1:0.35,f=Math.round(100*(i*0.55+p*0.23+s*0.17+c*0.05)),{ageHours:I,...S}=o;return{...S,score:_(f,0,100),rank:0}}).sort((o,i)=>i.score-o.score||i.velocity-o.velocity).map((o,i)=>({...o,rank:i+1}))}function M(e=Date.now()){let t=Math.floor(e/300000)%1000;return[{id:"demo-01",title:"5초 만에 시선을 붙잡는 오프닝 공식 3가지",channel:"크리에이터 랩",age:4,base:1842000,step:18400,tags:["shorts","유튜브성장","콘텐츠기획"],color:"ff5c35",description:"첫 문장, 화면 전환, 결과 선공개로 이탈률을 낮추는 오프닝 구조를 분석합니다."},{id:"demo-02",title:"평범한 책상이 영화 세트로 바뀌는 순간",channel:"메이크 씬",age:9,base:934200,step:12900,tags:["shorts","beforeafter","촬영팁"],color:"8b5cf6",description:"조명 하나와 카메라 무빙만으로 공간 분위기를 바꾸는 비포·애프터 영상입니다."},{id:"demo-03",title:"AI에게 하루를 맡겼더니 생긴 일",channel:"오늘의 실험실",age:18,base:2305000,step:9700,tags:["shorts","AI","experiment"],color:"20c997",description:"아침부터 저녁까지 AI의 선택만 따라가며 예상 밖의 결과를 기록한 실험형 콘텐츠입니다."},{id:"demo-04",title:"다들 반대로 알고 있는 스마트폰 촬영법",channel:"포켓 디렉터",age:3,base:442800,step:8300,tags:["shorts","스마트폰촬영","반전"],color:"0ea5e9",description:"디지털 줌과 피사체 거리의 흔한 오해를 한 장면 비교로 설명합니다."},{id:"demo-05",title:"60초 안에 끝내는 편집 리듬 체크리스트",channel:"컷앤비트",age:30,base:1128000,step:4100,tags:["shorts","영상편집","retention"],color:"f59e0b",description:"컷 길이, 효과음, 자막 밀도를 순서대로 점검하는 편집 체크리스트입니다."},{id:"demo-06",title:"댓글이 폭발하는 마지막 한 문장",channel:"스토리 메이커",age:12,base:672400,step:6200,tags:["shorts","댓글","스토리텔링"],color:"ec4899",description:"정답을 강요하지 않고 시청자의 경험을 끌어내는 엔딩 질문을 비교합니다."}].map((r,n)=>({videoId:r.id,title:r.title,channelTitle:r.channel,publishedAt:new Date(e-r.age*3600000).toISOString(),description:r.description,thumbnailUrl:`https://placehold.co/720x1280/${r.color}/09090b?text=${encodeURIComponent(`DEMO ${n+1}`)}`,durationSeconds:34+n*4,views:r.base+t*r.step,likes:Math.floor((r.base+t*r.step)*(0.038+n*0.003)),comments:Math.floor((r.base+t*r.step)*(0.0016+n*0.0002)),tags:r.tags,hasCaptions:n!==1,isDemo:!0}))}function x(e,t){try{let a=localStorage.getItem(e);return a?JSON.parse(a):t}catch{return t}}function k(){return localStorage.getItem("shorts-pulse:youtube-api-key")??""}function T(e){let t=e.trim();if(t)localStorage.setItem("shorts-pulse:youtube-api-key",t);else localStorage.removeItem("shorts-pulse:youtube-api-key")}function P(e){return{...e,...x("shorts-pulse:filters",{})}}function z(e){localStorage.setItem("shorts-pulse:filters",JSON.stringify(e))}function F(e){return`${e.region}:${e.periodHours}:${e.query.trim().toLocaleLowerCase()}`}function H(){return x("shorts-pulse:candidates:v1",null)}function N(e){localStorage.setItem("shorts-pulse:candidates:v1",JSON.stringify(e))}function V(e,t=Date.now()){let a=x("shorts-pulse:snapshots:v1",{}),r=new Map;for(let n of e){let i=[...a[n]??[]].reverse().find((p)=>p.capturedAt<t-30000);if(i)r.set(n,i)}return r}function L(e,t=Date.now()){let a=x("shorts-pulse:snapshots:v1",{});for(let n of e){let o=a[n.videoId]??[],i=o.at(-1);if(i&&t-i.capturedAt<30000)continue;o.push({videoId:n.videoId,capturedAt:t,views:n.views}),a[n.videoId]=o.slice(-288)}let r=Object.entries(a).sort(([,n],[,o])=>(o.at(-1)?.capturedAt??0)-(n.at(-1)?.capturedAt??0)).slice(0,80);localStorage.setItem("shorts-pulse:snapshots:v1",JSON.stringify(Object.fromEntries(r)))}var u=new Intl.NumberFormat("ko-KR",{notation:"compact",maximumFractionDigits:1}),Z=new Intl.NumberFormat("ko-KR"),K=new Intl.RelativeTimeFormat("ko",{numeric:"auto"});function d(e){return e.replace(/[&<>'"]/g,(t)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[t]??t)}function q(e){let t=Math.round((e-Date.now())/60000);if(Math.abs(t)<60)return K.format(t,"minute");return K.format(Math.round(t/60),"hour")}function ee(e){return`${Math.floor(e/60)}:${String(e%60).padStart(2,"0")}`}function te(e){return[`0–3초 · 질문/결과 선공개: “${e.title.replace(/[#|]/g," ").trim()}—왜 지금 주목받을까요?”`,"3–15초 · 직접 확인한 맥락과 핵심 사실 1개를 제시","15–40초 · 내 사례·실험·해설로 차별화한 전개","40–55초 · 결과와 배운 점을 한 문장으로 정리","55–60초 · 시청자의 경험을 묻는 자연스러운 질문"].join(`
`)}function oe(e){let t=e.isDemo?"#":`https://www.youtube.com/shorts/${encodeURIComponent(e.videoId)}`,a=e.dataQuality==="observed"?"5분 실측":"게시 후 평균 추정",r=e.tags.slice(0,8).map((o)=>`<span>#${d(o.replace(/^#/,""))}</span>`).join(""),n=e.dataQuality==="observed"?`+${u.format(e.viewDelta)}회`:`${u.format(e.velocity)}/시간`;return`
    <article class="video-card ${e.rank<=3?"video-card--top":""}">
      <div class="rank-block">
        <span class="rank-label">RANK</span>
        <strong>${String(e.rank).padStart(2,"0")}</strong>
        <div class="score-ring" style="--score:${e.score}" aria-label="급상승 점수 ${e.score}점">
          <span>${e.score}</span>
        </div>
      </div>
      <a class="thumb-wrap ${e.isDemo?"is-demo":""}" href="${t}" ${e.isDemo?'aria-disabled="true"':'target="_blank" rel="noopener noreferrer"'}>
        <img src="${d(e.thumbnailUrl)}" alt="${d(e.title)} 썸네일" loading="lazy" />
        <span class="duration">${ee(e.durationSeconds)}</span>
        <span class="play-icon" aria-hidden="true">▶</span>
      </a>
      <div class="video-main">
        <div class="card-kicker"><span class="pulse-dot"></span>${a} <b>${n}</b></div>
        <h2>${d(e.title)}</h2>
        <p class="channel">${d(e.channelTitle)} · ${q(Date.parse(e.publishedAt))}</p>
        <div class="metrics">
          <div><span>조회수</span><strong>${u.format(e.views)}</strong></div>
          <div><span>시간당 속도</span><strong>${u.format(e.velocity)}</strong></div>
          <div><span>반응률</span><strong>${(e.engagementRate*100).toFixed(1)}%</strong></div>
        </div>
        <div class="tags">${r||"<span>#태그없음</span>"}</div>
        <details>
          <summary>콘텐츠 브리프 · 대본 가이드 보기 <span>＋</span></summary>
          <div class="brief-grid">
            <section>
              <p class="eyebrow">원본 내용 요약</p>
              <p>${d(e.description.slice(0,420)||"영상 설명이 제공되지 않았습니다.")}</p>
            </section>
            <section>
              <p class="eyebrow">독창적 대본 가이드</p>
              <pre>${d(te(e))}</pre>
            </section>
          </div>
          <div class="caption-note">
            <strong>${e.hasCaptions?"자막 트랙 감지됨":"공개 자막 미감지"}</strong>
            실제 자막 원문은 영상 소유자 OAuth 권한 없이는 공식 API로 제공되지 않습니다. 원본을 재편집하기보다 사실을 재검증하고 직접 촬영·해설한 새 영상으로 제작하세요.
          </div>
        </details>
      </div>
      <div class="card-action">
        ${e.isDemo?'<span class="demo-link">DEMO</span>':`<a href="${t}" target="_blank" rel="noopener noreferrer">원본 보기 <span>↗</span></a>`}
        <small>${Z.format(e.likes)} 좋아요</small>
      </div>
    </article>
  `}function re(e){if(e.loading)return'<div class="empty-state"><div class="loader"></div><h2>급상승 신호를 스캔하고 있습니다</h2><p>YouTube 후보 영상과 최신 통계를 불러오는 중입니다.</p></div>';if(e.error)return`<div class="empty-state error-state"><span>!</span><h2>데이터를 불러오지 못했습니다</h2><p>${d(e.error)}</p><button class="primary-button" id="retry-button">다시 시도</button></div>`;return'<div class="empty-state"><h2>조건에 맞는 쇼츠가 없습니다</h2><p>검색어나 기간을 넓혀 다시 확인해 보세요.</p></div>'}function U(e,t,a){let r=t.videos.slice(0,3).reduce((p,s)=>p+s.views,0),n=t.videos.length?t.videos.reduce((p,s)=>p+s.velocity,0)/t.videos.length:0;e.innerHTML=`
    <div class="noise"></div>
    <header class="site-header">
      <a class="brand" href="#" aria-label="Shorts Pulse 홈">
        <span class="brand-mark">ϟ</span>
        <span><strong>SHORTS</strong><b>PULSE</b></span>
      </a>
      <div class="header-status">
        <span class="live-pill"><i></i>${t.mode==="live"?"LIVE API":"DEMO FEED"}</span>
        <span class="desktop-only">통계 5분 · 후보 1시간 자동 갱신</span>
      </div>
      <button class="icon-button" id="settings-button" aria-label="API 설정">API 설정 <span>⚙</span></button>
    </header>

    <main>
      <section class="hero">
        <div>
          <p class="eyebrow accent">CREATOR INTELLIGENCE / ${t.filters.region}</p>
          <h1>다음 바이럴을<br/><em>숫자로 먼저</em> 발견하세요.</h1>
          <p class="hero-copy">조회수 스냅샷을 5분 간격으로 비교해, 지금 가속 중인 쇼츠를 우선순위로 정렬합니다.</p>
        </div>
        <div class="hero-orbit" aria-hidden="true">
          <div class="orbit orbit-1"></div><div class="orbit orbit-2"></div>
          <span class="orbit-core">ϟ</span>
          <span class="signal signal-a">+184%</span><span class="signal signal-b">VPH</span>
        </div>
      </section>

      ${t.mode==="demo"?`
        <aside class="demo-banner">
          <div><strong>현재 샘플 데이터입니다.</strong><span>YouTube API 키를 브라우저에 연결하면 실제 급상승 데이터를 확인할 수 있습니다.</span></div>
          <button id="connect-api-button">실시간 API 연결 →</button>
        </aside>`:""}

      <section class="control-panel">
        <form id="filter-form">
          <label><span>국가</span><select name="region">
            ${[["KR","대한민국"],["US","미국"],["JP","일본"],["GB","영국"]].map(([p,s])=>`<option value="${p}" ${t.filters.region===p?"selected":""}>${s}</option>`).join("")}
          </select></label>
          <label><span>게시 기간</span><select name="periodHours">
            <option value="24" ${t.filters.periodHours===24?"selected":""}>최근 24시간</option>
            <option value="168" ${t.filters.periodHours===168?"selected":""}>최근 7일</option>
            <option value="720" ${t.filters.periodHours===720?"selected":""}>최근 30일</option>
          </select></label>
          <label class="search-field"><span>주제 키워드</span><input name="query" value="${d(t.filters.query)}" placeholder="예: AI, 요리, 운동 (비우면 전체)" /></label>
          <button class="primary-button" type="submit">레이더 스캔</button>
        </form>
        <button class="refresh-button" id="refresh-button" ${t.loading?"disabled":""}><span class="refresh-icon">↻</span> 지금 갱신</button>
      </section>

      <section class="stat-strip">
        <div><span>감지 영상</span><strong>${t.videos.length}</strong><small>SHORTS</small></div>
        <div><span>TOP 3 누적 조회</span><strong>${u.format(r)}</strong><small>VIEWS</small></div>
        <div><span>평균 확산 속도</span><strong>${u.format(n)}</strong><small>VIEWS / H</small></div>
        <div><span>마지막 신호</span><strong>${t.lastUpdatedAt?q(t.lastUpdatedAt):"대기"}</strong><small id="countdown" data-next="${t.nextStatsRefreshAt??""}">${t.nextStatsRefreshAt?"다음 갱신 계산 중":"API 연결 필요"}</small></div>
      </section>

      <section class="radar-heading">
        <div><p class="eyebrow">SURGE RANKING</p><h2>지금 가속 중인 쇼츠</h2></div>
        <div class="legend"><span><i class="observed"></i>5분 실측</span><span><i></i>게시 후 평균 추정</span></div>
      </section>

      <section class="video-list">
        ${t.videos.length?t.videos.map(oe).join(""):re(t)}
      </section>

      <section class="method-note">
        <span>01</span><div><strong>후보 탐색</strong><p>#shorts와 선택 주제를 기준으로 최대 50개 후보를 1시간마다 검색합니다.</p></div>
        <span>02</span><div><strong>속도 측정</strong><p>브라우저에 저장된 조회수 스냅샷을 비교해 시간당 증가량을 계산합니다.</p></div>
        <span>03</span><div><strong>우선순위</strong><p>증가 속도 55% · 최신성 23% · 반응률 17% · 실측 신뢰도 5%를 합산합니다.</p></div>
      </section>
    </main>

    <footer><span>SHORTS PULSE © ${new Date().getFullYear()}</span><p>트렌드는 참고하고, 창작은 새롭게. 원본 영상의 저작권과 YouTube 정책을 존중하세요.</p></footer>

    <dialog id="api-dialog">
      <form method="dialog" id="api-form">
        <button class="dialog-close" value="cancel" aria-label="닫기">×</button>
        <p class="eyebrow accent">LIVE DATA CONNECTION</p>
        <h2>YouTube API 연결</h2>
        <p>Google Cloud에서 YouTube Data API v3를 활성화한 뒤 API 키를 입력하세요. 키는 이 브라우저에만 저장되며 Google API 호출에만 사용됩니다.</p>
        <label><span>API KEY</span><input id="api-key-input" type="password" autocomplete="off" placeholder="AIza..." /></label>
        <div class="dialog-actions">
          <button class="danger-button" type="button" id="clear-api-button">연결 해제</button>
          <button class="primary-button" type="submit">저장하고 실시간 시작</button>
        </div>
        <small>권장: HTTP 리퍼러를 이 사이트 주소로 제한한 별도 키를 사용하세요. 키를 GitHub 저장소에 커밋하지 않습니다.</small>
      </form>
    </dialog>
  `;let o=e.querySelector("#api-dialog"),i=()=>o?.showModal();e.querySelector("#settings-button")?.addEventListener("click",i),e.querySelector("#connect-api-button")?.addEventListener("click",i),e.querySelector("#refresh-button")?.addEventListener("click",a.onRefresh),e.querySelector("#retry-button")?.addEventListener("click",a.onRefresh),e.querySelector("#filter-form")?.addEventListener("submit",(p)=>{p.preventDefault();let s=new FormData(p.currentTarget);a.onApplyFilters({region:String(s.get("region")),periodHours:Number(s.get("periodHours")),query:String(s.get("query")??"")})}),e.querySelector("#api-form")?.addEventListener("submit",(p)=>{p.preventDefault();let s=e.querySelector("#api-key-input");if(s?.value.trim())a.onSaveApiKey(s.value),o?.close();else s?.focus()}),e.querySelector("#clear-api-button")?.addEventListener("click",()=>{a.onClearApiKey(),o?.close()})}function E(e){let t=e.querySelector("#countdown"),a=Number(t?.dataset.next??0);if(!t||!a)return;let r=Math.max(0,Math.ceil((a-Date.now())/1000)),n=Math.floor(r/60);t.textContent=`NEXT IN ${String(n).padStart(2,"0")}:${String(r%60).padStart(2,"0")}`}var Y=300000,G=3600000,ne={region:"KR",periodHours:24,query:""},j=document.querySelector("#app");if(!j)throw new Error("App root was not found.");var R=j,l={mode:k()?"live":"demo",loading:!1,error:null,filters:P(ne),videos:[],lastUpdatedAt:null,nextStatsRefreshAt:null,nextCandidateSearchAt:null},v=0,y=!1;function m(e){l={...l,...e},J()}function B(e,t){let a=V(e.map((n)=>n.videoId),t),r=O(e,a,t);return L(e,t),r}function J(){U(R,l,{onOpenSettings:()=>{return},onSaveApiKey:(e)=>{T(e),m({mode:"live",error:null,videos:[]}),h(!0)},onClearApiKey:()=>{T(""),m({mode:"demo",error:null}),g()},onRefresh:()=>{if(l.mode==="live")h(!1);else g()},onApplyFilters:(e)=>{if(z(e),m({filters:e,error:null}),l.mode==="live")h(!0);else g()}}),E(R)}function g(){v+=1;let e=Date.now(),t=B(M(e),e);m({mode:"demo",loading:!1,error:null,videos:t,lastUpdatedAt:e,nextStatsRefreshAt:e+Y,nextCandidateSearchAt:null})}function ae(e){if(e instanceof b){if(e.reason==="quotaExceeded"||e.reason==="dailyLimitExceeded")return"오늘의 YouTube API 할당량을 모두 사용했습니다. Google Cloud 할당량을 확인해 주세요.";if(e.reason==="keyInvalid"||e.reason==="ipRefererBlocked")return"API 키가 유효하지 않거나 현재 사이트 주소가 허용되지 않았습니다.";return e.message}if(e instanceof TypeError)return"네트워크 연결 또는 API 키의 HTTP 리퍼러 제한을 확인해 주세요.";return e instanceof Error?e.message:"알 수 없는 오류가 발생했습니다."}async function h(e){let t=k();if(!t){g();return}if(y)return;y=!0;let a=++v;m({mode:"live",loading:!0,error:null});try{let r=Date.now(),n=F(l.filters),o=H(),i=o&&o.filtersKey===n&&r-o.searchedAt<G&&o.videos.length>0,p,s;if(!e&&i)p=await A(t,o.videos.map((f)=>f.videoId)),s=o.searchedAt;else p=await $(t,l.filters),s=r;if(a!==v)return;let c=Date.now();N({filtersKey:n,searchedAt:s,videos:p}),m({mode:"live",loading:!1,error:null,videos:B(p,c),lastUpdatedAt:c,nextStatsRefreshAt:c+Y,nextCandidateSearchAt:s+G})}catch(r){if(a===v)m({loading:!1,error:ae(r),videos:[],nextStatsRefreshAt:null,nextCandidateSearchAt:null})}finally{y=!1}}J();if(l.mode==="live")h(!1);else g();window.setInterval(()=>{if(E(R),y)return;let e=Date.now();if(l.mode==="demo"&&l.nextStatsRefreshAt&&e>=l.nextStatsRefreshAt)g();else if(l.mode==="live"&&l.nextCandidateSearchAt&&e>=l.nextCandidateSearchAt)h(!0);else if(l.mode==="live"&&l.nextStatsRefreshAt&&e>=l.nextStatsRefreshAt)h(!1)},1000);

//# debugId=6FB4440E8BADF14764756E2164756E21
