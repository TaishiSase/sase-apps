/* Calendar enhancements: finite recurrence, transport, and latest changes. */
var REPEAT_LABELS={weekly:'毎週',biweekly:'隔週',monthly:'毎月'};
var TRANSPORT_LABELS={papa:'パパ',mama:'ママ',both:'ふたり',other:'ほかの人'};
function recurrenceDates(start,until,rule){
 if(!rule)return [start];
 var first=parseDate(start),end=parseDate(until),out=[];
 if(!until||isNaN(end)||end<first||end>new Date(first.getFullYear()+1,first.getMonth(),first.getDate()))throw Error('繰り返しの終了日を1年以内で指定してください');
 for(var i=0;i<367;i++){
  var d;
  if(rule==='monthly'){
   d=new Date(first.getFullYear(),first.getMonth()+i,1);
   var last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
   d.setDate(Math.min(first.getDate(),last));
  }else{d=new Date(first);d.setDate(d.getDate()+i*(rule==='biweekly'?14:7));}
  if(d>end)break;out.push(dateStr(d));
 }
 return out;
}
function resetScheduleExtras(s){
 document.getElementById('dropoffBy').value=s&&s.dropoff_by||'';
 updateMorningDropoff(s?s.event_type:addEventType);
 document.getElementById('repeatRule').value='';
 document.getElementById('repeatUntil').value='';
 document.getElementById('repeatSettings').hidden=!!(s&&s.id);
 document.getElementById('repeatUntilRow').hidden=true;
 document.getElementById('seriesEditNote').hidden=!(s&&s.series_id);
}
function morningDropoff(s){if(['早朝全日出社','出張'].includes(s.event_type))return 'できない';if(s.event_type==='全日出社')return 'できる';return TRANSPORT_LABELS[s.dropoff_by]||'未確認';}
function updateMorningDropoff(type){var automatic=['早朝全日出社','出張','全日出社'].includes(type);document.getElementById('dropoffManual').hidden=automatic;document.getElementById('dropoffRule').textContent=automatic?'朝の送り：'+morningDropoff({event_type:type}):'朝の送り担当を選んでください';}
function transportText(s){return '朝の送り：'+morningDropoff(s)+' ／ 迎え：ママ';}
function renderScheduleExtras(s,body){
 var wrap=document.createElement('section');wrap.className='schedule-extras-view';
 var transport=transportText(s);if(transport){var p=document.createElement('p');p.textContent=transport;wrap.appendChild(p);}
 if(s.repeat_rule){var p=document.createElement('p');p.textContent=REPEAT_LABELS[s.repeat_rule]+'の予定 · 編集・削除はこの回だけに反映';wrap.appendChild(p);}
 var fields={date:'開始日',date_end:'終了日',member:'だれ',event_type:'予定',event_label:'内容',time_type:'時間帯',time_start:'開始時刻',time_end:'終了時刻',place:'場所',office_location:'出社先',trip_destination:'出張先',return_time:'帰宅時刻',needs_dinner:'夕食',dropoff_by:'送り',pickup_by:'迎え'};
 function value(key,v){if(v==null||v==='')return '未設定';if(key==='dropoff_by'||key==='pickup_by')return TRANSPORT_LABELS[v]||v;if(key==='member')return MEMBERS[v]?.label||v;if(typeof v==='boolean')return v?'あり':'なし';return String(v);}
 var changed=Object.keys(s.last_changes||{}).filter(k=>fields[k]);
 if(changed.length){var detail=document.createElement('details');detail.className='ux-details';var summary=document.createElement('summary');summary.textContent='前回からの変更（'+changed.length+'項目）';detail.appendChild(summary);changed.forEach(function(k){var p=document.createElement('p');p.textContent=fields[k]+'：'+value(k,s.last_changes[k].before)+' → '+value(k,s.last_changes[k].after);detail.appendChild(p);});wrap.appendChild(detail);}
 body.appendChild(wrap);
}
