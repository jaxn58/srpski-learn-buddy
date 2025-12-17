import { useAuth } from "@/_core/hooks/useAuth";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Link } from "wouter";
// Sidebar import removed
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  TrendingUp, Calendar, Award, Zap, Target,
  BookOpen, Clock, CheckCircle2, Trophy, Flame
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { COURSE_WEEKS, COURSE_MODULES, getModuleProgress } from "@shared/data";

const COLORS = ['#22c55e', '#ef4444']; // Green for Correct, Red for Incorrect

export default function Progress() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const stats = useQuery(api.progress.getDashboardStats);
  const isLoading = stats === undefined;

  if (!user) {
    window.location.href = "/";
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Fallback data if no stats (should rarely happen for active users)
  const completedUnits = stats?.completedUnits || [];
  const totalUnits = 27;
  const progressPercent = (completedUnits.length / totalUnits) * 100;
  
  // Memoize modules list to prevent duplicate renders
  const modulesList = useMemo(() => COURSE_MODULES, []);
  
  // Format dates for chart
  const activityData = stats?.activityChart?.map(day => ({
    name: new Date(day.date).toLocaleDateString(i18n.language === 'de' ? 'de-DE' : 'en-US', { weekday: 'short' }),
    xp: day.xp,
    fullDate: new Date(day.date).toLocaleDateString()
  })) || [];

  // Accuracy Data
  const accuracyData = [
    { name: t('progress.correct'), value: stats?.accuracyStats?.totalCorrect || 0 },
    { name: t('progress.incorrect'), value: stats?.accuracyStats?.totalIncorrect || 0 },
  ];
  const hasAccuracyData = (stats?.accuracyStats?.totalAttempts || 0) > 0;

  // Level Calculation (simple logic for display)
  const nextLevelXP = (stats?.level || 1) * 1000; // Example: 1000 XP per level
  const currentLevelXP = (stats?.totalXP || 0) % 1000;
  const levelProgress = Math.min(100, (currentLevelXP / 1000) * 100);

  // Calculate days since start
  const startDate = stats?.creationTime ? new Date(stats.creationTime) : new Date();
  const daysSinceStart = Math.max(1, Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  
  // Container Animation
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1 
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: "spring", stiffness: 100 }
    }
  };

  return (
    <div className="bg-slate-50/50 min-h-full">
        <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10 -mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6 lg:-mx-8 lg:-mt-8 lg:px-8 mb-8">
          <div className="container py-4">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="hover:bg-slate-100">
                  ← {t('progress.backToDashboard')}
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                  {t('progress.title')}
                </h1>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto">
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            {/* HERO SECTION: GAMIFICATION */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Level Card */}
              <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white overflow-hidden relative border-none shadow-lg">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Trophy className="w-32 h-32" />
                </div>
                <CardContent className="p-6 relative z-10 flex items-center justify-between">
                  <div>
                    <div className="text-blue-100 text-sm font-medium mb-1">Current Level</div>
                    <div className="text-4xl font-bold mb-2">Level {stats?.level || 1}</div>
                    <div className="text-blue-100 text-sm mb-4">
                      {Math.floor(stats?.totalXP || 0)} Total XP
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-blue-100">
                        <span>Progress to Lvl {(stats?.level || 1) + 1}</span>
                        <span>{Math.round(levelProgress)}%</span>
                      </div>
                      <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-white/90 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${levelProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="h-20 w-20 rounded-full bg-white/10 flex items-center justify-center border-4 border-white/20">
                    <Zap className="h-10 w-10 text-yellow-300 fill-yellow-300" />
                  </div>
                </CardContent>
              </Card>

              {/* Streak Card */}
              <Card className="bg-gradient-to-br from-orange-500 to-red-600 text-white overflow-hidden relative border-none shadow-lg">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Flame className="w-32 h-32" />
                </div>
                <CardContent className="p-6 relative z-10 flex items-center justify-between h-full">
                  <div>
                    <div className="text-orange-100 text-sm font-medium mb-1">Winning Streak</div>
                    <div className="text-4xl font-bold mb-2">{stats?.currentStreak || 0} Days</div>
                    <div className="text-orange-100 text-sm">
                      Keep it up! Practice daily to build your habit.
                    </div>
                  </div>
                  <div className="h-20 w-20 rounded-full bg-white/10 flex items-center justify-center border-4 border-white/20 animate-pulse">
                    <Flame className="h-10 w-10 text-white fill-white" />
                  </div>
                </CardContent>
              </Card>

              {/* Mastery Card */}
              <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6 flex flex-col justify-center h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                      <Target className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Course Mastery</div>
                      <div className="text-2xl font-bold">
                        {Math.round(progressPercent)}%
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Units Completed</span>
                      <span className="font-medium">{completedUnits.length} / {totalUnits}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Words Mastered</span>
                      <span className="font-medium">{stats?.accuracyStats?.masteredVocab || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Days Active</span>
                      <span className="font-medium">{daysSinceStart}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </motion.div>

            {/* CHARTS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Activity Chart */}
              <motion.div variants={itemVariants} className="lg:col-span-2">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      XP Activity (Last 7 Days)
                    </CardTitle>
                    <CardDescription>Your learning consistency over the past week</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            dy={10}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748b', fontSize: 12 }}
                          />
                          <RechartsTooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            cursor={{ fill: '#f1f5f9' }}
                          />
                          <Bar 
                            dataKey="xp" 
                            fill="#3b82f6" 
                            radius={[4, 4, 0, 0]} 
                            barSize={40}
                            animationDuration={1500}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Accuracy Chart */}
              <motion.div variants={itemVariants}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      Accuracy Rate
                    </CardTitle>
                    <CardDescription>Based on all your answers</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center pt-0">
                    {hasAccuracyData ? (
                      <div className="h-[250px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={accuracyData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {accuracyData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip />
                            <Legend verticalAlign="bottom" height={36} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[60%] text-center">
                          <div className="text-3xl font-bold text-slate-800">
                            {Math.round((accuracyData[0].value / (accuracyData[0].value + accuracyData[1].value)) * 100)}%
                          </div>
                          <div className="text-xs text-muted-foreground">Correct</div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm text-center px-8">
                        Not enough data yet. Complete some exercises to see your accuracy!
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* MODULES OVERVIEW SECTION */}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    {t('progress.unitsOverview')}
                  </CardTitle>
                  <CardDescription>{t('progress.unitsOverviewDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {modulesList.map((module) => {
                      const moduleProgress = getModuleProgress(module.id, completedUnits);
                      const moduleTitle = i18n.language === 'de' ? module.titleGerman : module.titleEnglish;
                      
                      return (
                        <div key={`module-${module.number}-${module.id}`} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="text-sm bg-slate-50">
                                {t('units.module', { number: module.number })}
                              </Badge>
                              <span className="font-semibold text-slate-700">{moduleTitle}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {t('progress.lessonsCompleted', { 
                                completed: moduleProgress.completed, 
                                total: moduleProgress.total 
                              })}
                            </span>
                          </div>
                          <ProgressBar value={moduleProgress.percentage} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Achievements Section */}
            <motion.div variants={itemVariants}>
              {completedUnits.length > 0 && (
                <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 border-amber-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-800">
                      <Award className="h-5 w-5 text-amber-600" />
                      {t('progress.achievements')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
                      {/* First Steps */}
                      <div className={`flex flex-col items-center p-4 rounded-xl border ${completedUnits.length >= 1 ? 'bg-white border-amber-100 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-50 grayscale'}`}>
                        <div className="text-4xl mb-2">🎯</div>
                        <div className="font-bold text-sm text-center mb-1">{t('progress.achievement.firstSteps')}</div>
                        <div className="text-xs text-muted-foreground text-center">{t('progress.achievement.firstSteps.desc')}</div>
                      </div>

                      {/* Getting Started */}
                      <div className={`flex flex-col items-center p-4 rounded-xl border ${completedUnits.length >= 5 ? 'bg-white border-amber-100 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-50 grayscale'}`}>
                        <div className="text-4xl mb-2">🚀</div>
                        <div className="font-bold text-sm text-center mb-1">{t('progress.achievement.gettingStarted')}</div>
                        <div className="text-xs text-muted-foreground text-center">{t('progress.achievement.gettingStarted.desc')}</div>
                      </div>

                      {/* Halfway There */}
                      <div className={`flex flex-col items-center p-4 rounded-xl border ${completedUnits.length >= 10 ? 'bg-white border-amber-100 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-50 grayscale'}`}>
                        <div className="text-4xl mb-2">⭐</div>
                        <div className="font-bold text-sm text-center mb-1">{t('progress.achievement.halfwayThere')}</div>
                        <div className="text-xs text-muted-foreground text-center">{t('progress.achievement.halfwayThere.desc')}</div>
                      </div>

                      {/* Almost There */}
                      <div className={`flex flex-col items-center p-4 rounded-xl border ${completedUnits.length >= 20 ? 'bg-white border-amber-100 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-50 grayscale'}`}>
                        <div className="text-4xl mb-2">🏆</div>
                        <div className="font-bold text-sm text-center mb-1">{t('progress.achievement.almostThere')}</div>
                        <div className="text-xs text-muted-foreground text-center">{t('progress.achievement.almostThere.desc')}</div>
                      </div>

                      {/* Master */}
                      <div className={`flex flex-col items-center p-4 rounded-xl border ${completedUnits.length === 27 ? 'bg-white border-amber-100 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-50 grayscale'}`}>
                        <div className="text-4xl mb-2">🎓</div>
                        <div className="font-bold text-sm text-center mb-1">{t('progress.achievement.courseMaster')}</div>
                        <div className="text-xs text-muted-foreground text-center">{t('progress.achievement.courseMaster.desc')}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>

          </motion.div>

          <footer className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
            <p className="font-semibold">© Developed by JACKSENN.ME 2025</p>
          </footer>
        </div>
    </div>
  );
}
