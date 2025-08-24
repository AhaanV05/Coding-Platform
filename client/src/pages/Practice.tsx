import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { problemsAPI } from '../services/api';
import { debounce } from 'lodash';

interface Problem {
  id: number;
  title: string;
  description: string;
  difficulty_level: string;
  topic_tags: string[];
  source_platform: string;
  source_problem_id: string;
  created_at: string;
  time_limit_ms: number;
  memory_limit_mb: number;
  test_cases?: any[];
}

interface Topic {
  name: string;
  selected: boolean;
}

const Practice: React.FC = () => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProblems, setTotalProblems] = useState(0);
  
  // Filters
  const [difficulty, setDifficulty] = useState<string>('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Available topics
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([]);
  const [showTopicSelector, setShowTopicSelector] = useState(false);

  // Timer state
  const [activeTimer, setActiveTimer] = useState<number | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [totalTimeSpent, setTotalTimeSpent] = useState<Record<number, number>>({});

  const fetchProblems = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit: 20,
        difficulty: difficulty || undefined,
        topics: selectedTopics.length > 0 ? JSON.stringify(selectedTopics) : undefined
      };

      const response = await problemsAPI.getAll(params);
      
      if (response.data.success) {
        setProblems(response.data.problems);
        setTotalPages(response.data.pagination.pages);
        setTotalProblems(response.data.pagination.total);
        setError(null);
      } else {
        setError('Failed to fetch problems');
      }
    } catch (err: any) {
      console.error('Error fetching problems:', err);
      setError('Failed to fetch problems');
    } finally {
      setLoading(false);
    }
  }, [page]); // Only depend on page, not on filters

  const fetchAvailableTopics = useCallback(async () => {
    try {
      const response = await problemsAPI.getAvailableTopics();
      if (response.data.success) {
        const topics = response.data.topics.map((topic: string) => ({
          name: topic,
          selected: false
        }));
        setAvailableTopics(topics);
      }
    } catch (err: any) {
      console.error('Error fetching topics:', err);
    }
  }, []);

  useEffect(() => {
    fetchAvailableTopics();
  }, [fetchAvailableTopics]);

  // Initial load only - no auto-search
  useEffect(() => {
    fetchProblems();
  }, []); // Empty dependency array - only runs once on mount

  // Timer functionality
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTimer !== null) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTimer]);

  const startTimer = (problemId: number) => {
    setActiveTimer(problemId);
    setTimerSeconds(0);
  };

  const stopTimer = () => {
    if (activeTimer !== null) {
      setTotalTimeSpent(prev => ({
        ...prev,
        [activeTimer]: (prev[activeTimer] || 0) + timerSeconds
      }));
    }
    setActiveTimer(null);
    setTimerSeconds(0);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTopicToggle = (topicName: string) => {
    setSelectedTopics(prev => {
      if (prev.includes(topicName)) {
        return prev.filter(t => t !== topicName);
      } else {
        return [...prev, topicName];
      }
    });
    // Don't auto-search - user must click search button
  };

  const clearFilters = () => {
    setDifficulty('');
    setSelectedTopics([]);
    setSearchTerm('');
    setPage(1);
    // Don't auto-search - user must click search button
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'text-green-600 bg-green-100';
      case 'Medium': return 'text-yellow-600 bg-yellow-100';
      case 'Hard': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const handleSearch = useCallback(() => {
    setPage(1);
    // Create a new fetch function with current searchTerm
    const searchWithCurrentTerm = async () => {
      try {
        setLoading(true);
        const params: any = {
          page: 1,
          limit: 20,
          difficulty: difficulty || undefined,
          topics: selectedTopics.length > 0 ? JSON.stringify(selectedTopics) : undefined,
          search: searchTerm || undefined
        };

        const response = await problemsAPI.getAll(params);
        
        if (response.data.success) {
          setProblems(response.data.problems);
          setTotalPages(response.data.pagination.pages);
          setTotalProblems(response.data.pagination.total);
          setError(null);
        } else {
          setError('Failed to fetch problems');
        }
      } catch (err: any) {
        console.error('Error fetching problems:', err);
        setError('Failed to fetch problems');
      } finally {
        setLoading(false);
      }
    };
    
    searchWithCurrentTerm();
  }, [difficulty, selectedTopics, searchTerm]);

  // Wrap handleSearch in debounce
  const debouncedSearch = useCallback(
    debounce(() => {
      handleSearch();
    }, 500), // wait 500ms after user stops typing
    [difficulty, selectedTopics, searchTerm] // re-create when these change
  );

  // Run debounced search whenever searchTerm changes
  useEffect(() => {
    if (searchTerm.trim() !== '') {
      debouncedSearch();
    }
    return debouncedSearch.cancel; // cleanup debounce on unmount/re-render
  }, [searchTerm, debouncedSearch]);

  if (loading && problems.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error && problems.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Practice Problems</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={fetchProblems}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Practice Problems</h1>
          <p className="text-gray-600">Solve problems from LeetCode to improve your skills</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search practice problems..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  // onKeyPress={(e) => e.key === 'Enter' && handleSearch()} // not needed ad using debounce, kept for future need
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '⏳' : '🔍'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Press Enter or click the search button to search
              </p>
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Difficulties</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>



            {/* Topics */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Topics</label>
              <button
                onClick={() => setShowTopicSelector(!showTopicSelector)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-left"
              >
                {selectedTopics.length > 0 
                  ? `${selectedTopics.length} topic(s) selected`
                  : 'Select topics...'
                }
              </button>
            </div>
          </div>

          {/* Topic Selector */}
          {showTopicSelector && (
            <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {availableTopics.map((topic) => (
                  <label key={topic.name} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedTopics.includes(topic.name)}
                      onChange={() => handleTopicToggle(topic.name)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{topic.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Filter Actions */}
          <div className="mt-4 flex justify-between items-center">
            <button
              onClick={clearFilters}
              className="text-gray-600 hover:text-gray-800 text-sm"
            >
              Clear all filters
            </button>
            <div className="text-sm text-gray-500">
              {totalProblems} practice problems found
            </div>
          </div>
        </div>

        {/* Practice Problems List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Problem
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Difficulty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Topics
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Test Cases
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {problems.map((problem) => (
                  <tr key={problem.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{problem.title}</div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {problem.description}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDifficultyColor(problem.difficulty_level)}`}>
                        {problem.difficulty_level}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {problem.topic_tags.slice(0, 3).map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                        {problem.topic_tags.length > 3 && (
                          <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                            +{problem.topic_tags.length - 3}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className={`px-6 py-4 whitespace-nowrap ${
                      activeTimer === problem.id ? 'bg-green-50' : ''
                    }`}>
                      <div className="text-sm text-gray-500">
                        {problem.test_cases && problem.test_cases.length > 0 ? (
                          `${problem.test_cases.length} test case(s)`
                        ) : (
                          'No test cases'
                        )}
                        {activeTimer === problem.id && (
                          <div className="mt-2 p-2 bg-green-100 rounded-md border border-green-200">
                            <div className="text-xs font-mono text-green-700 flex items-center justify-between">
                              <span>⏱️ Timer: {formatTime(timerSeconds)}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  stopTimer();
                                }}
                                className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50"
                              >
                                Stop
                              </button>
                            </div>
                          </div>
                        )}
                        {totalTimeSpent[problem.id] && totalTimeSpent[problem.id] > 0 && (
                          <div className="mt-1 text-xs text-gray-500">
                            Total time: {formatTime(totalTimeSpent[problem.id])}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            if (activeTimer === problem.id) {
                              // Timer is already running, just navigate
                              window.location.href = `/problems/${problem.id}`;
                            } else {
                              // Ask for confirmation to start timer
                              if (window.confirm('Do you want to start the timer?')) {
                                startTimer(problem.id);
                                // Navigate after starting timer with a small delay
                                setTimeout(() => {
                                  window.location.href = `/problems/${problem.id}`;
                                }, 200);
                              } else {
                                // Navigate without starting timer
                                window.location.href = `/problems/${problem.id}`;
                              }
                            }
                          }}
                          title={activeTimer === problem.id 
                            ? 'Continue solving with active timer' 
                            : 'Click to solve - you can choose to start a timer'
                          }
                          className={`${
                            activeTimer === problem.id 
                              ? 'text-green-600 hover:text-green-900' 
                              : 'text-primary-600 hover:text-primary-900'
                          }`}
                        >
                          {activeTimer === problem.id ? 'Continue' : 'Solve'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing page <span className="font-medium">{page}</span> of{' '}
                    <span className="font-medium">{totalPages}</span>
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          pageNum === page
                            ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Empty State */}
        {!loading && problems.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">No practice problems found</h3>
            <p className="text-gray-600">Try adjusting your filters or check back later.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Practice;
