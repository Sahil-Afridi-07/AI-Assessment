// Subject / topic catalog. Drives the Practice dropdowns AND the first (non-AI)
// validation layer for custom subtopics. Keywords are lowercase phrases.
const T = (name, kw = '') => ({ name, keywords: kw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) });
const OOP = 'class,object,inheritance,polymorphism,encapsulation,abstraction,method overriding,method overloading,constructor,interface,abstract class,multiple inheritance';
const COMMON_PROG = 'variable,data type,operator,loop,for loop,while loop,function,recursion,array,string,condition,if else,switch,scope,debugging,algorithm,syntax,keyword,input output';

const subject = (id, name, category, topics, extra = '') => ({
  id, name, category, topics,
  keywords: extra.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
});

const SUBJECTS = [
  // ---- Aptitude & Reasoning ----
  subject('aptitude', 'Aptitude', 'Aptitude & Reasoning', [
    T('Percentages', 'percentage,percent,increase,decrease'),
    T('Profit and Loss', 'profit,loss,discount,cost price,selling price,marked price,margin'),
    T('Simple and Compound Interest', 'simple interest,compound interest,principal,rate of interest,interest'),
    T('Time and Work', 'work,pipes,cistern,efficiency,men days,wages'),
    T('Time, Speed and Distance', 'speed,distance,train,boat,stream,relative speed,average speed'),
    T('Ratio and Proportion', 'ratio,proportion,partnership,variation'),
    T('Averages', 'average,mean,weighted average'),
    T('Permutation and Combination', 'permutation,combination,arrangement,selection,factorial'),
    T('Probability', 'probability,dice,coin,cards,chance'),
    T('Number Series', 'number series,sequence,pattern,missing number'),
    T('Mixtures and Alligation', 'mixture,alligation'),
    T('Ages', 'age problem,ages'),
    T('HCF and LCM', 'hcf,lcm,gcd,factors,multiples,divisibility,remainder'),
    T('Data Interpretation', 'data interpretation,table,pie chart,bar graph,line graph,caselet'),
  ], 'quantitative,numerical ability,arithmetic,maths,math'),
  subject('reasoning', 'Logical Reasoning', 'Aptitude & Reasoning', [
    T('Syllogisms', 'syllogism,all some none,venn'),
    T('Blood Relations', 'blood relation,family tree,relationship'),
    T('Coding-Decoding', 'coding,decoding,cipher,letter coding'),
    T('Direction Sense', 'direction,north,south,east,west,distance and direction'),
    T('Seating Arrangement', 'seating,circular arrangement,linear arrangement,row arrangement'),
    T('Puzzles', 'puzzle,floor puzzle,box puzzle,scheduling'),
    T('Series and Analogy', 'analogy,odd one out,classification,letter series,alphabet series'),
    T('Statements and Conclusions', 'statement,conclusion,assumption,argument,inference,course of action'),
    T('Clocks and Calendars', 'clock,calendar,day of the week,angle between hands'),
    T('Venn Diagrams', 'venn diagram,sets overlap'),
  ], 'logic,logical,reasoning,deduction,critical thinking'),
  subject('verbal', 'Verbal Ability', 'Aptitude & Reasoning', [
    T('Grammar', 'grammar,tense,subject verb agreement,article,preposition,parts of speech,voice,narration,conjunction,pronoun,noun,verb,adjective,adverb'),
    T('Vocabulary', 'vocabulary,word meaning,word usage,root words'),
    T('Synonyms and Antonyms', 'synonym,antonym,opposite,similar meaning'),
    T('Reading Comprehension', 'reading comprehension,passage,inference,main idea,paragraph'),
    T('Sentence Correction', 'sentence correction,error spotting,sentence improvement'),
    T('Para Jumbles', 'para jumble,sentence rearrangement,ordering sentences'),
    T('Idioms and Phrases', 'idiom,phrase,proverb'),
    T('Fill in the Blanks', 'fill in the blanks,cloze test,sentence completion'),
    T('One Word Substitution', 'one word substitution'),
  ], 'english,verbal,language,comprehension,spelling'),

  // ---- Programming ----
  subject('python', 'Python', 'Programming', [
    T('Basics', 'variable,data type,operator,input output,type casting,indentation,print'),
    T('Control Flow', 'if else,elif,for loop,while loop,break,continue,pass,loop,range'),
    T('Functions', 'function,lambda,arguments,default argument,args,kwargs,recursion,scope,closure,return,global,nonlocal'),
    T('Data Structures', 'list,tuple,dictionary,dict,set,comprehension,list comprehension,slicing,sorting,mutable,immutable'),
    T('Object-Oriented Programming', OOP + ',init,self,super,dunder,magic method,mro,method resolution order,oop,property'),
    T('Exception Handling', 'try,except,finally,raise,custom exception,exception,error handling,assert,else block'),
    T('File Handling', 'file,open,read,write,csv,json,with statement,pickle'),
    T('Modules and Packages', 'module,package,import,pip,virtual environment,venv,standard library'),
    T('Decorators and Generators', 'decorator,generator,yield,iterator,context manager,iterable'),
    T('Strings', 'string,f-string,format,split,join,regex,regular expression,string method'),
    T('Libraries', 'numpy,pandas,matplotlib,requests,flask,django'),
  ], 'python,py,' + COMMON_PROG),
  subject('java', 'Java', 'Programming', [
    T('Basics', 'jvm,jdk,jre,bytecode,data type,variable,operator,main method,wrapper class,autoboxing'),
    T('Object-Oriented Programming', OOP + ',this,super,final,static,access modifier,package,oop'),
    T('Collections', 'collection,arraylist,linkedlist,hashmap,hashset,treemap,treeset,iterator,list,set,map,queue,comparable,comparator'),
    T('Exception Handling', 'exception,try,catch,finally,throw,throws,checked exception,unchecked exception,custom exception'),
    T('Multithreading', 'thread,runnable,synchronized,concurrency,deadlock,executor,thread pool,volatile'),
    T('Strings', 'string,stringbuilder,stringbuffer,string pool,immutable'),
    T('Generics', 'generic,wildcard,type parameter'),
    T('Interfaces and Abstract Classes', 'interface,abstract class,default method,functional interface'),
    T('Java 8 Features', 'lambda,stream,optional,functional interface,method reference'),
    T('Memory and Garbage Collection', 'garbage collection,heap,stack,memory,jvm memory'),
  ], 'java,' + COMMON_PROG),
  subject('c', 'C', 'Programming', [
    T('Basics', 'data type,variable,operator,printf,scanf,format specifier,storage class,typecasting,header file'),
    T('Pointers', 'pointer,address,dereference,null pointer,pointer arithmetic,double pointer,void pointer,dangling pointer'),
    T('Arrays and Strings', 'array,string,multidimensional array,string function,strlen,strcpy'),
    T('Functions', 'function,recursion,call by value,call by reference,function pointer,prototype'),
    T('Structures and Unions', 'structure,struct,union,enum,typedef,bit field'),
    T('Dynamic Memory', 'malloc,calloc,realloc,free,dynamic memory,memory leak,heap'),
    T('File Handling', 'file,fopen,fclose,fread,fwrite,fprintf,fscanf'),
    T('Preprocessor', 'preprocessor,macro,define,include,conditional compilation'),
  ], 'c language,c programming,' + COMMON_PROG),
  subject('cpp', 'C++', 'Programming', [
    T('Object-Oriented Programming', OOP + ',destructor,friend function,this pointer,oop,access specifier,static member'),
    T('STL', 'stl,vector,map,set,list,deque,iterator,algorithm,priority queue,unordered map,container'),
    T('Templates', 'template,generic programming,function template,class template'),
    T('Pointers and References', 'pointer,reference,const,address,null pointer,dereference'),
    T('Memory Management', 'new,delete,smart pointer,unique ptr,shared ptr,raii,memory leak,heap,stack'),
    T('Exception Handling', 'exception,try,catch,throw,noexcept'),
    T('Operator Overloading', 'operator overloading,overload'),
    T('Virtual Functions', 'virtual function,vtable,pure virtual,dynamic binding,late binding,abstract class'),
  ], 'c++,cpp,' + COMMON_PROG),

  // ---- Computer Science Core ----
  subject('dbms', 'Database Management Systems', 'Computer Science Core', [
    T('ER Model', 'er model,entity,relationship,attribute,cardinality,er diagram,weak entity,generalization,specialization'),
    T('Normalization', 'normalization,1nf,2nf,3nf,bcnf,functional dependency,decomposition,lossless,denormalization'),
    T('SQL', 'sql,select,join,inner join,outer join,group by,having,subquery,ddl,dml,view,aggregate,query,union,constraint,trigger,stored procedure,cursor'),
    T('Transactions', 'transaction,acid,commit,rollback,isolation,atomicity,durability,consistency,savepoint'),
    T('Concurrency Control', 'concurrency,locking,two phase locking,2pl,deadlock,serializability,timestamp,schedule,recoverability'),
    T('Indexing', 'index,b tree,b+ tree,hashing,clustered index,primary index,secondary index'),
    T('Relational Algebra', 'relational algebra,projection,selection,cartesian product,relational calculus'),
    T('Keys', 'primary key,foreign key,candidate key,super key,unique key,composite key'),
    T('NoSQL', 'nosql,mongodb,document database,key value,cap theorem,redis,cassandra'),
  ], 'dbms,database,databases,rdbms,mysql,postgresql,oracle,table,schema,relational'),
  subject('os', 'Operating Systems', 'Computer Science Core', [
    T('Process Management', 'process,pcb,process state,context switch,fork,zombie,orphan,system call'),
    T('CPU Scheduling', 'scheduling,fcfs,sjf,round robin,priority scheduling,turnaround time,waiting time,preemptive,srtf,multilevel queue'),
    T('Deadlocks', 'deadlock,banker algorithm,mutual exclusion,hold and wait,resource allocation graph,deadlock prevention,deadlock avoidance,starvation'),
    T('Memory Management', 'memory management,paging,segmentation,virtual memory,page replacement,tlb,thrashing,page fault,fragmentation,lru,fifo,demand paging'),
    T('Synchronization', 'semaphore,mutex,critical section,monitor,race condition,producer consumer,readers writers,dining philosophers,peterson'),
    T('File Systems', 'file system,inode,directory,allocation methods,fat,ext4,file allocation'),
    T('Disk Scheduling', 'disk scheduling,scan,c-scan,look,sstf,seek time,raid'),
    T('Threads and IPC', 'thread,multithreading,ipc,pipe,message passing,shared memory,socket'),
  ], 'os,operating system,kernel,linux,unix,shell,bootloader,interrupt'),
  subject('cn', 'Computer Networks', 'Computer Science Core', [
    T('OSI and TCP/IP Models', 'osi,tcp/ip,layers,physical layer,network layer,session layer,presentation layer,encapsulation'),
    T('IP Addressing and Subnetting', 'ip address,ipv4,ipv6,subnet,subnetting,cidr,vlsm,subnet mask,nat,private ip'),
    T('Routing', 'routing,rip,ospf,bgp,distance vector,link state,router,routing table,dijkstra'),
    T('Transport Layer', 'tcp,udp,congestion control,flow control,sliding window,three way handshake,port,socket'),
    T('Application Layer', 'http,https,dns,smtp,ftp,dhcp,pop3,imap,telnet,ssh,www'),
    T('Data Link Layer', 'mac,ethernet,arp,crc,framing,error detection,hamming code,csma,csma/cd,switch,vlan,stop and wait'),
    T('Network Security', 'ssl,tls,firewall,encryption,vpn,cryptography,digital signature,ipsec,authentication,attack'),
    T('Network Devices and Topologies', 'hub,switch,router,bridge,gateway,topology,star,bus,ring,mesh,lan,wan,man'),
  ], 'cn,networking,network,networks,internet,protocol,bandwidth,latency,throughput'),
  subject('dsa', 'Data Structures and Algorithms', 'Computer Science Core', [
    T('Arrays and Strings', 'array,string,two pointer,sliding window,prefix sum,matrix'),
    T('Linked Lists', 'linked list,singly linked,doubly linked,circular linked,reverse list'),
    T('Stacks and Queues', 'stack,queue,deque,circular queue,priority queue,monotonic stack,infix,postfix'),
    T('Trees', 'tree,binary tree,bst,binary search tree,avl,heap,traversal,inorder,preorder,postorder,trie,segment tree,red black'),
    T('Graphs', 'graph,bfs,dfs,dijkstra,minimum spanning tree,mst,kruskal,prim,topological sort,shortest path,bellman ford,floyd warshall'),
    T('Sorting', 'sorting,quick sort,merge sort,bubble sort,insertion sort,selection sort,heap sort,radix sort,counting sort'),
    T('Searching', 'searching,binary search,linear search,ternary search'),
    T('Hashing', 'hashing,hash table,hash function,collision,chaining,open addressing'),
    T('Dynamic Programming', 'dynamic programming,dp,memoization,tabulation,knapsack,lcs,longest common subsequence,coin change,edit distance'),
    T('Greedy and Backtracking', 'greedy,backtracking,n queens,activity selection,huffman,branch and bound'),
    T('Complexity Analysis', 'time complexity,space complexity,big o,asymptotic,recurrence,master theorem,amortized'),
  ], 'dsa,data structure,data structures,algorithm,algorithms,recursion'),
  subject('coa', 'Computer Organization and Architecture', 'Computer Science Core', [
    T('CPU and Instruction Cycle', 'cpu,instruction cycle,fetch decode execute,register,alu,control unit,instruction set,addressing mode,risc,cisc'),
    T('Pipelining', 'pipeline,pipelining,hazard,data hazard,control hazard,stall,speedup'),
    T('Memory Hierarchy and Cache', 'cache,cache memory,memory hierarchy,mapping,direct mapped,associative,hit ratio,ram,rom,virtual memory'),
    T('I/O Organization', 'dma,interrupt,i/o,input output,bus'),
    T('Number Systems and Arithmetic', 'binary,hexadecimal,octal,twos complement,floating point,ieee 754,booth'),
  ], 'computer architecture,computer organization,microprocessor,8085,8086,processor'),
  subject('toc', 'Theory of Computation', 'Computer Science Core', [
    T('Finite Automata', 'dfa,nfa,finite automata,regular language,minimization,epsilon nfa'),
    T('Regular Expressions', 'regular expression,regex,pumping lemma'),
    T('Context-Free Grammars', 'cfg,context free grammar,pda,pushdown automata,parse tree,ambiguity,chomsky normal form,cnf,gnf'),
    T('Turing Machines', 'turing machine,decidability,undecidable,halting problem,recursive,recursively enumerable'),
    T('Complexity Classes', 'p vs np,np complete,np hard,reduction,sat,complexity class'),
  ], 'automata,formal language,formal languages,toc'),
  subject('compiler', 'Compiler Design', 'Computer Science Core', [
    T('Lexical Analysis', 'lexical analysis,lexer,token,lexeme,scanner,lex'),
    T('Parsing', 'parsing,parser,ll1,lr,slr,lalr,top down,bottom up,first and follow,yacc,syntax analysis'),
    T('Semantic Analysis and IR', 'semantic analysis,syntax directed translation,intermediate code,three address code,symbol table,type checking'),
    T('Code Optimization and Generation', 'code optimization,code generation,register allocation,basic block,peephole,dead code'),
  ], 'compiler,compilers,interpreter,assembler'),
  subject('se', 'Software Engineering', 'Computer Science Core', [
    T('SDLC Models', 'sdlc,waterfall,spiral,agile,scrum,prototype,incremental,v model,devops,kanban'),
    T('Requirements Engineering', 'requirement,srs,use case,functional requirement,non functional,feasibility'),
    T('Software Design', 'design pattern,uml,cohesion,coupling,class diagram,sequence diagram,architecture,modularity'),
    T('Software Testing', 'testing,unit test,integration test,black box,white box,regression,test case,debugging,tdd'),
    T('Project Management', 'cocomo,estimation,risk management,gantt,pert,configuration management,version control,git'),
  ], 'software engineering,software development,software'),
  subject('csf', 'Computer Science Fundamentals', 'Computer Science Core', [
    T('Computer Fundamentals', 'computer,hardware,software,generation of computers,input device,output device,memory,storage'),
    T('Number Systems and Boolean Algebra', 'number system,binary,boolean algebra,logic gates,k map,flip flop,combinational,sequential'),
    T('Web Technologies', 'html,css,javascript,web,http,rest,api,frontend,backend,browser,react,node'),
    T('Cyber Security Basics', 'cyber security,malware,phishing,encryption,firewall,authentication,hashing'),
  ], 'computer science,cs,computing,information technology,it'),

  // ---- AI & ML ----
  subject('ai', 'Artificial Intelligence', 'AI & Machine Learning', [
    T('Search Algorithms', 'search,bfs,dfs,a*,a star,heuristic,uniform cost,greedy best first,iterative deepening,hill climbing,informed search,uninformed search'),
    T('Game Playing', 'minimax,alpha beta,pruning,game tree'),
    T('Knowledge Representation', 'knowledge representation,propositional logic,predicate logic,first order logic,semantic network,frames,ontology,resolution,inference'),
    T('Constraint Satisfaction and Planning', 'constraint satisfaction,csp,backtracking,planning,strips,means ends analysis'),
    T('Expert Systems and Fuzzy Logic', 'expert system,fuzzy logic,fuzzy set,membership function,rule based,inference engine'),
    T('Natural Language Processing', 'nlp,natural language,tokenization,stemming,lemmatization,pos tagging,parsing,language model,transformer,word embedding'),
    T('Computer Vision and Robotics', 'computer vision,image,object detection,robotics,perception,segmentation'),
    T('Genetic Algorithms', 'genetic algorithm,evolutionary,crossover,mutation,fitness,swarm,ant colony'),
    T('Agents', 'intelligent agent,rational agent,agent,environment,peas,turing test'),
  ], 'ai,artificial intelligence,intelligent systems'),
  subject('ml', 'Machine Learning', 'AI & Machine Learning', [
    T('Supervised Learning', 'supervised,linear regression,logistic regression,decision tree,svm,support vector,knn,k nearest,naive bayes,classification,regression'),
    T('Unsupervised Learning', 'unsupervised,k means,clustering,pca,dbscan,hierarchical clustering,dimensionality reduction,association rule,apriori'),
    T('Model Evaluation', 'accuracy,precision,recall,f1,confusion matrix,roc,auc,cross validation,train test split,metric,rmse,mse'),
    T('Overfitting and Regularization', 'overfitting,underfitting,bias,variance,regularization,l1,l2,lasso,ridge,dropout,early stopping'),
    T('Neural Networks and Deep Learning', 'neural network,perceptron,backpropagation,activation function,cnn,rnn,lstm,gradient descent,deep learning,relu,sigmoid,softmax,transformer,loss function,optimizer'),
    T('Ensemble Methods', 'ensemble,random forest,boosting,bagging,xgboost,adaboost,gradient boosting,stacking'),
    T('Feature Engineering', 'feature engineering,normalization,standardization,one hot,feature selection,missing values,scaling,encoding,imputation'),
    T('Reinforcement Learning', 'reinforcement,q learning,reward,policy,markov decision process,mdp,exploration exploitation'),
  ], 'ml,machine learning,data science,model,training,dataset'),

  // ---- Mathematics ----
  subject('math', 'Mathematics', 'Mathematics', [
    T('Algebra', 'algebra,equation,quadratic,polynomial,inequality,logarithm,exponent,progression,arithmetic progression,geometric progression,binomial'),
    T('Calculus', 'calculus,limit,derivative,integral,differentiation,integration,continuity,maxima,minima,differential equation,series'),
    T('Linear Algebra', 'linear algebra,matrix,determinant,eigenvalue,eigenvector,vector,rank,vector space,linear transformation,inverse'),
    T('Probability and Statistics', 'probability,statistics,mean,median,mode,variance,standard deviation,distribution,normal distribution,hypothesis testing,bayes,correlation,regression,expectation'),
    T('Discrete Mathematics', 'discrete,set,relation,function,graph theory,propositional logic,combinatorics,recurrence,boolean,group,lattice,pigeonhole'),
    T('Trigonometry and Geometry', 'trigonometry,geometry,sine,cosine,triangle,circle,area,volume,coordinate geometry,angle'),
    T('Number Theory', 'number theory,prime,modular arithmetic,gcd,congruence,fermat,euler,divisibility'),
  ], 'maths,mathematics,math,mathematical'),
];

const catalog = {
  subjects: SUBJECTS,
  byId: Object.fromEntries(SUBJECTS.map((s) => [s.id, s])),
};

// Shape sent to the browser (keywords are not needed client-side).
function publicCatalog() {
  const cats = new Map();
  for (const s of SUBJECTS) {
    if (!cats.has(s.category)) cats.set(s.category, []);
    cats.get(s.category).push({ id: s.id, name: s.name, topics: s.topics.map((t) => t.name) });
  }
  return [...cats.entries()].map(([name, subjects]) => ({ name, subjects }));
}

module.exports = { catalog, publicCatalog };
